from datetime import datetime
from typing import Optional, Union
from pydantic import BaseModel


class ProjectInterestCreate(BaseModel):
    project_id: Union[int, str]
    message: Optional[str] = None


class ProjectInterestResponse(BaseModel):
    id: Union[int, str]
    project_id: Union[int, str]
    investor_id: Optional[Union[int, str]] = None
    founder_id: Optional[Union[int, str]] = None
    status: str = "pending"
    message: Optional[str] = None
    created_at: Optional[Union[datetime, str]] = None
