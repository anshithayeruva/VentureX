"""Funding rounds and investment allocations (founders run rounds; investors propose and commit)."""
from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import CurrentUser, require_founder, require_investor
from app.core.rate_limit import rate_limit
from app.schemas.funding import (
    AcceptInput, ExternalAllocationInput, ProposalInput, ReceiptInput, RejectInput, RoundInput, RoundStatusInput,
)
from app.services.funding_service import FundingError, FundingService

router = APIRouter(tags=["Funding"])
_writes = [Depends(rate_limit("funding_write", 120, 3600))]


def _err(e: FundingError) -> HTTPException:
    return HTTPException(status_code=e.status, detail={"code": e.code, "message": e.message})


async def _run(coro):
    try:
        return await coro
    except FundingError as e:
        raise _err(e)


# ---------------------------------------------------------------- founders


@router.get("/projects/{project_id}/funding")
async def project_funding(project_id: int, user: CurrentUser = Depends(require_founder)):
    """Every round for the startup, with totals and each investor's allocation (founding team only)."""
    return await _run(FundingService.project_funding(user.id, project_id))


@router.post("/projects/{project_id}/rounds", status_code=201, dependencies=_writes)
async def create_round(project_id: int, body: RoundInput, user: CurrentUser = Depends(require_founder)):
    return await _run(FundingService.create_round(user.id, project_id, body.model_dump()))


@router.put("/rounds/{round_id}", dependencies=_writes)
async def update_round(round_id: int, body: RoundInput, user: CurrentUser = Depends(require_founder)):
    return await _run(FundingService.update_round(user.id, round_id, body.model_dump()))


@router.post("/rounds/{round_id}/status", dependencies=_writes)
async def set_round_status(round_id: int, body: RoundStatusInput, user: CurrentUser = Depends(require_founder)):
    """Open, close, reopen or cancel a round. Closing cancels proposals still in negotiation."""
    return await _run(FundingService.set_round_status(user.id, round_id, body.status))


@router.post("/rounds/{round_id}/external", status_code=201, dependencies=_writes)
async def add_external(round_id: int, body: ExternalAllocationInput, user: CurrentUser = Depends(require_founder)):
    """Record a commitment from an investor who isn't on VentureX."""
    return await _run(FundingService.add_external(user.id, round_id, body.model_dump()))


@router.post("/allocations/{alloc_id}/accept", dependencies=_writes)
async def accept(alloc_id: int, body: AcceptInput, user: CurrentUser = Depends(require_founder)):
    """Agree terms for a proposal; the investor confirms to commit."""
    return await _run(FundingService.accept(user.id, alloc_id, body.model_dump()))


@router.post("/allocations/{alloc_id}/reject", dependencies=_writes)
async def reject(alloc_id: int, body: RejectInput, user: CurrentUser = Depends(require_founder)):
    return await _run(FundingService.reject(user.id, alloc_id, body.note))


@router.post("/allocations/{alloc_id}/cancel-commitment", dependencies=_writes)
async def cancel_commitment(alloc_id: int, user: CurrentUser = Depends(require_founder)):
    """Cancel an allocation that has no capital received."""
    return await _run(FundingService.cancel_by_founder(user.id, alloc_id))


@router.post("/allocations/{alloc_id}/receipts", status_code=201, dependencies=_writes)
async def record_receipt(alloc_id: int, body: ReceiptInput, user: CurrentUser = Depends(require_founder)):
    """Record capital actually received (or refunded) against a commitment. No money moves through VentureX."""
    return await _run(FundingService.record_receipt(user.id, alloc_id, body.model_dump()))


# ---------------------------------------------------------------- investors


@router.get("/projects/{project_id}/rounds")
async def investor_rounds(project_id: int, user: CurrentUser = Depends(require_investor)):
    """Open rounds (and rounds you're in): terms, progress if the founders disclose it, and your allocation only."""
    return await _run(FundingService.investor_rounds(user.id, project_id))


@router.post("/rounds/{round_id}/proposals", status_code=201, dependencies=_writes)
async def propose(round_id: int, body: ProposalInput, user: CurrentUser = Depends(require_investor)):
    """Offer to invest. Needs a verified account and an accepted intro with the startup."""
    return await _run(FundingService.propose(user.id, round_id, body.amount, body.note))


@router.get("/investors/allocations")
async def my_allocations(user: CurrentUser = Depends(require_investor)):
    return await FundingService.investor_portfolio(user.id)


@router.get("/investors/allocations/{alloc_id}")
async def my_allocation(alloc_id: int, user: CurrentUser = Depends(require_investor)):
    return await _run(FundingService.investor_allocation(user.id, alloc_id))


@router.post("/investors/allocations/{alloc_id}/confirm", dependencies=_writes)
async def confirm(alloc_id: int, user: CurrentUser = Depends(require_investor)):
    """Confirm the terms the founders accepted: your capital is then committed."""
    return await _run(FundingService.investor_confirm(user.id, alloc_id))


@router.post("/investors/allocations/{alloc_id}/withdraw", dependencies=_writes)
async def withdraw(alloc_id: int, user: CurrentUser = Depends(require_investor)):
    return await _run(FundingService.investor_cancel(user.id, alloc_id))


@router.post("/investors/receipts/{txn_id}/confirm", dependencies=_writes)
async def confirm_receipt(txn_id: int, user: CurrentUser = Depends(require_investor)):
    """Acknowledge that a receipt the founders recorded matches your transfer."""
    return await _run(FundingService.acknowledge_receipt(user.id, txn_id))
