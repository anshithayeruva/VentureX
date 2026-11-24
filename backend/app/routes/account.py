"""The signed-in user's profile, settings and account; profile photos and project logos."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.core.auth import CurrentUser, require_admin, require_user
from app.core.rate_limit import rate_limit
from app.database import postgres as pg
from app.schemas.account import DeletionRequestInput, FounderProfileInput, InvestorProfileInput, SettingsInput
from app.services import settings_service
from app.services.profile_service import ProfileError, ProfileService, image_file, remove_image, save_image
from app.services.team_service import TeamService

router = APIRouter(tags=["Profile, settings and account"])


def _err(e: ProfileError) -> HTTPException:
    return HTTPException(status_code=e.status, detail={"code": e.code, "message": e.message})


def _role(user: CurrentUser) -> str:
    if user.role not in ("FOUNDER", "INVESTOR"):
        raise HTTPException(status_code=409, detail="Choose founder or investor first.")
    return user.role


# ---------------------------------------------------------------- profile


@router.get("/me/profile")
async def my_profile(user: CurrentUser = Depends(require_user)):
    """Your full profile. Email comes from your sign-in account and isn't editable here."""
    return await ProfileService.get(user.id, _role(user))


@router.put("/me/profile")
async def update_my_profile(body: dict, user: CurrentUser = Depends(require_user)):
    role = _role(user)
    model = FounderProfileInput if role == "FOUNDER" else InvestorProfileInput
    try:
        data = model.model_validate(body).model_dump()
    except ValueError as e:
        raise HTTPException(status_code=422, detail=_first_error(e))
    return await ProfileService.update(user.id, role, data)


def _first_error(e) -> str:
    try:
        err = e.errors()[0]
        field = ".".join(str(x) for x in err.get("loc", []))
        msg = str(err.get("msg", "Invalid value")).replace("Value error, ", "")
        return f"{field.replace('_', ' ').capitalize()}: {msg}" if field else msg
    except Exception:
        return "Some details aren't valid."


@router.post("/me/profile/photo", dependencies=[Depends(rate_limit("photo_upload", 20, 3600))])
async def upload_my_photo(file: UploadFile = File(...), user: CurrentUser = Depends(require_user)):
    """PNG, JPEG or WebP, up to 2 MB."""
    data = await file.read(2 * 1024 * 1024 + 1)
    try:
        return await ProfileService.set_photo(user.id, _role(user), data)
    except ProfileError as e:
        raise _err(e)


@router.delete("/me/profile/photo")
async def remove_my_photo(user: CurrentUser = Depends(require_user)):
    return await ProfileService.set_photo(user.id, _role(user), None)


@router.get("/users/{user_id}/photo")
async def user_photo(user_id: str, user: CurrentUser = Depends(require_user)):
    """A user's profile photo (signed-in users only)."""
    found = await ProfileService.photo_for(user_id)
    if not found:
        raise HTTPException(status_code=404, detail="No photo")
    return FileResponse(found[0], media_type=found[1], headers={"Cache-Control": "private, max-age=300"})


# ---------------------------------------------------------------- settings


@router.get("/me/settings")
async def my_settings(user: CurrentUser = Depends(require_user)):
    """Your notification, privacy and display settings, with the available choices."""
    role = _role(user)
    await ProfileService._ensure(user.id, role)
    return {
        "settings": await settings_service.stored_settings(user.id, role),
        "categories": settings_service.FOUNDER_CATEGORIES if role == "FOUNDER" else settings_service.INVESTOR_CATEGORIES,
        "date_formats": list(settings_service.DATE_FORMATS),
    }


@router.put("/me/settings")
async def save_my_settings(body: SettingsInput, user: CurrentUser = Depends(require_user)):
    role = _role(user)
    try:
        clean = settings_service.validate(role, body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    table = "founder_profiles" if role == "FOUNDER" else "investor_profiles"
    stored = dict(clean)
    # Older keys other code still reads stay in step.
    if role == "FOUNDER":
        stored.update({"default_private": clean["privacy"]["default_private"],
                       "email_alerts": clean["notifications"]["email_enabled"], "hide_gaps_from_investors": True})
    else:
        stored.update({"direct_founder_messaging": clean["privacy"]["direct_founder_messaging"],
                       "auto_notify_high_conviction": True})
    await ProfileService._ensure(user.id, role)
    extra = ", listed_for_founders = %s" if role == "INVESTOR" else ""
    params = [pg.Jsonb(stored)] + ([clean["privacy"]["listed_for_founders"]] if role == "INVESTOR" else []) + [user.id]
    await pg.execute(f"UPDATE {table} SET settings = %s{extra}, updated_at = now() WHERE user_id = %s", params)
    return await my_settings(user)


# ---------------------------------------------------------------- account


@router.get("/me/account")
async def my_account(user: CurrentUser = Depends(require_user)):
    """Account details and status. Passwords and sessions are managed by the sign-in service."""
    return await ProfileService.account(user)


@router.post("/me/deletion-request", status_code=status.HTTP_202_ACCEPTED)
async def request_deletion(body: DeletionRequestInput, user: CurrentUser = Depends(require_user)):
    """Ask VentureX to delete your account. An admin processes it; you can cancel until then."""
    await ProfileService.request_deletion(user.id, body.reason)
    return await ProfileService.account(user)


@router.delete("/me/deletion-request")
async def cancel_deletion(user: CurrentUser = Depends(require_user)):
    await ProfileService.cancel_deletion(user.id)
    return await ProfileService.account(user)


@router.get("/admin/deletion-requests")
async def deletion_requests(user: CurrentUser = Depends(require_admin)):
    return await ProfileService.deletion_requests()


# ---------------------------------------------------------------- founders on a startup, logos


async def _visible_project(project_id: int, user: CurrentUser) -> dict:
    project = await pg.fetch_one("SELECT id, founder_id, is_published, logo_path FROM projects WHERE id = %s", [project_id])
    if not project or not (project["is_published"] or await TeamService.can_work_on(user.id, project)):
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/projects/{project_id}/founders")
async def project_founders(project_id: int, user: CurrentUser = Depends(require_user)):
    """The startup's founders as you may see them (their privacy settings apply; contact details only
    for investors they're connected with)."""
    return await ProfileService.founders_for_viewer(await _visible_project(project_id, user), user)


@router.get("/projects/{project_id}/logo")
async def project_logo(project_id: int, user: CurrentUser = Depends(require_user)):
    project = await _visible_project(project_id, user)
    found = image_file(project.get("logo_path"))
    if not found:
        raise HTTPException(status_code=404, detail="No logo")
    return FileResponse(found[0], media_type=found[1], headers={"Cache-Control": "private, max-age=300"})


@router.post("/projects/{project_id}/logo", dependencies=[Depends(rate_limit("logo_upload", 20, 3600))])
async def upload_project_logo(project_id: int, file: UploadFile = File(...), user: CurrentUser = Depends(require_user)):
    project = await pg.fetch_one("SELECT id, founder_id, logo_path FROM projects WHERE id = %s", [project_id])
    if not await TeamService.can_work_on(user.id, project):
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        name = save_image(f"logo-{project_id}", await file.read(2 * 1024 * 1024 + 1))
    except ProfileError as e:
        raise _err(e)
    await pg.execute("UPDATE projects SET logo_path = %s, updated_at = now() WHERE id = %s", [name, project_id])
    remove_image(project.get("logo_path"))
    return {"has_logo": True}


@router.delete("/projects/{project_id}/logo")
async def remove_project_logo(project_id: int, user: CurrentUser = Depends(require_user)):
    project = await pg.fetch_one("SELECT id, founder_id, logo_path FROM projects WHERE id = %s", [project_id])
    if not await TeamService.can_work_on(user.id, project):
        raise HTTPException(status_code=404, detail="Project not found")
    await pg.execute("UPDATE projects SET logo_path = NULL, updated_at = now() WHERE id = %s", [project_id])
    remove_image(project.get("logo_path"))
    return {"has_logo": False}
