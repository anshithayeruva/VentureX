"""Verification endpoints: investors send evidence, founders verify their company, admins review."""
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.auth import CurrentUser, require_admin, require_founder, require_investor
from app.core.rate_limit import rate_limit
from app.schemas.investor import PortfolioEntry
from app.services.verification_service import VerificationError, VerificationService

router = APIRouter(tags=["Verification"])


def _err(e: VerificationError) -> HTTPException:
    return HTTPException(status_code=e.status, detail={"code": e.code, "message": e.message})


class InvestorEvidence(BaseModel):
    linkedin_url: str = Field(..., max_length=300)
    website: str = Field(..., max_length=300)
    past_investments: List[PortfolioEntry] = Field(..., min_length=1, max_length=20)


class CodeRequest(BaseModel):
    email: str = Field(..., max_length=254)


class CodeConfirm(BaseModel):
    code: str = Field(..., min_length=4, max_length=12)


class RegistrationEvidence(BaseModel):
    registration_type: Literal["gstin", "cin", "llpin", "udyam"]
    registration_number: str = Field(..., max_length=40)
    note: Optional[str] = Field(None, max_length=1000)


class Review(BaseModel):
    decision: Literal["approve", "reject", "revoke"]
    note: Optional[str] = Field(None, max_length=1000)


# ---------------------------------------------------------------- investors


@router.get("/investors/verification")
async def my_investor_verification(user: CurrentUser = Depends(require_investor)):
    """Your verification status and the evidence you sent."""
    return await VerificationService.get_investor(user.id)


@router.post("/investors/verification", dependencies=[Depends(rate_limit("investor_verification", 10, 3600))])
async def submit_investor_verification(body: InvestorEvidence, user: CurrentUser = Depends(require_investor)):
    """Send your LinkedIn, firm website and past investments for review."""
    try:
        return await VerificationService.submit_investor(
            user.id, body.linkedin_url, body.website, [d.model_dump(mode="json") for d in body.past_investments])
    except VerificationError as e:
        raise _err(e)


# ---------------------------------------------------------------- companies


@router.get("/projects/{project_id}/verification")
async def company_verification(project_id: int, user: CurrentUser = Depends(require_founder)):
    """Where verifying this company stands."""
    try:
        return await VerificationService.get_company(user.id, project_id)
    except VerificationError as e:
        raise _err(e)


@router.post("/projects/{project_id}/verification/email",
             dependencies=[Depends(rate_limit("company_code", 6, 3600))])
async def send_company_code(project_id: int, body: CodeRequest, user: CurrentUser = Depends(require_founder)):
    """Email a code to an address on the startup's website domain."""
    try:
        return await VerificationService.send_code(user.id, project_id, body.email)
    except VerificationError as e:
        raise _err(e)


@router.post("/projects/{project_id}/verification/confirm",
             dependencies=[Depends(rate_limit("company_code_confirm", 20, 3600))])
async def confirm_company_code(project_id: int, body: CodeConfirm, user: CurrentUser = Depends(require_founder)):
    """Enter the code from the email to verify the company."""
    try:
        return await VerificationService.confirm_code(user.id, project_id, body.code)
    except VerificationError as e:
        raise _err(e)


@router.post("/projects/{project_id}/verification/registration",
             dependencies=[Depends(rate_limit("company_registration", 10, 3600))])
async def submit_company_registration(project_id: int, body: RegistrationEvidence,
                                      user: CurrentUser = Depends(require_founder)):
    """No company domain? Send a GSTIN, CIN, LLPIN or Udyam number; an admin checks it."""
    try:
        return await VerificationService.submit_registration(
            user.id, project_id, body.registration_type, body.registration_number, body.note)
    except VerificationError as e:
        raise _err(e)


# ---------------------------------------------------------------- admin


@router.get("/admin/verifications/counts")
async def admin_counts(user: CurrentUser = Depends(require_admin)):
    return await VerificationService.counts()


@router.get("/admin/verifications")
async def admin_queue(
    kind: Literal["investor", "company"] = "investor",
    status: Optional[Literal["pending", "verified", "rejected", "code_sent", "unverified"]] = Query(None),
    user: CurrentUser = Depends(require_admin),
):
    """Investors or companies to review, with their evidence. Without a status: everything but untouched accounts."""
    return await VerificationService.queue(kind, status)


@router.post("/admin/investors/{user_id}/review")
async def review_investor(user_id: str, body: Review, user: CurrentUser = Depends(require_admin)):
    try:
        return await VerificationService.review_investor(user.id, user_id, body.decision, body.note)
    except VerificationError as e:
        raise _err(e)


@router.post("/admin/companies/{project_id}/review")
async def review_company(project_id: int, body: Review, user: CurrentUser = Depends(require_admin)):
    try:
        return await VerificationService.review_company(user.id, project_id, body.decision, body.note)
    except VerificationError as e:
        raise _err(e)
