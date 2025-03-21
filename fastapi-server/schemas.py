from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from typing import List, Dict, Any, Optional, ClassVar

class BaseSchema(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(
        alias_generator=to_camel,
        from_attributes=True,
        extra="forbid",
    )


class CognitiveProfile(BaseModel):
    memory: int
    attention: int
    language: int
    visuospatial: int
    executive: int


class UserInDB(BaseModel):
    """
    Represents a user in the system, including their cognitive profile and preferences.
    """
    id: str = Field(description="Unique identifier for the user")
    cognitive_profile: CognitiveProfile = Field(
        description="User's cognitive profile, including memory, attention, language, visual-spatial, and executive functions"
    )


class ChunkData(BaseSchema):
    """
    Represents a discrete piece of educational content that can be adapted and processed.
    """
    original_content: str = Field(
        description="The original, unmodified content exactly as extracted from the source"
    )

    adapted_content: Optional[str] = Field(
        default=None,
        description="The content after adaptation processing; null when not yet processed",
    )

    page: int = Field(
        description="Page number (0-indexed) where this chunk appears in the document"
    )

    order: int = Field(
        description="Sequence order of this chunk within the document for proper rendering"
    )

    type: str = Field(
        default="text",
        description="Content type: 'text', 'image', 'table', or other specialized formats",
    )

    is_adapted: bool = Field(
        default=False,
        description="Flag indicating whether this chunk has been processed by the adaptation system",
    )

    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional information about the chunk, such as image paths, context, etc.",
    )

    @property
    def content(self) -> str:
        """
        Helper property that returns adapted_content if available, otherwise original_content.
        Used for rendering content when adaptation status is unknown.
        """
        return self.adapted_content if self.adapted_content else self.original_content
