from typing import Literal, Optional
from pydantic import BaseModel, Field


class MeResponse(BaseModel):
    """The signed-in Neon Auth user plus their VentureX role."""
    id: str
    email: str
    name: Optional[str] = None
    role: Optional[Literal["FOUNDER", "INVESTOR"]] = None
    organization: Optional[str] = None


class OnboardingInput(BaseModel):
    """Chosen once, right after sign-up."""
    role: Literal["FOUNDER", "INVESTOR"]
    name: Optional[str] = Field(None, max_length=200)
    organization: Optional[str] = Field(None, max_length=200)
