from groq import Groq
from core.config import settings
from utils.defaults import GroqModels

groq_client = Groq(
    api_key=settings.GROQ_API_KEY,
)

image_description_prompt = """You are a technical image analysis expert. You will be provided with various types of images extracted from documents like research papers, technical blogs, and more.
Your task is to generate concise, accurate descriptions of the images without adding any information you are not confident about.
Focus on capturing the key details, trends, or relationships depicted in the image.

Important Guidelines:
* Prioritize accuracy:  If you are uncertain about any detail, state "Unknown" or "Not visible" instead of guessing.
* Avoid hallucinations: Do not add information that is not directly supported by the image.
* Be specific: Use precise language to describe shapes, colors, textures, and any interactions depicted.
* Consider context: If the image is a screenshot or contains text, incorporate that information into your description.
"""
import PIL
import base64
import io
import pathlib
from typing import Optional

class Image:
    """The image that can be sent to a generative model."""

    _image_bytes: bytes
    _loaded_image: Optional["PIL.Image"] = None

    @staticmethod
    def load_from_file(location: str) -> "Image":
        """Loads image from file.

        Args:
            location: Local path from where to load the image.

        Returns:
            Loaded image as an `Image` object.
        """
        image_bytes = pathlib.Path(location).read_bytes()
        image = Image()
        image._image_bytes = image_bytes
        return image

    @staticmethod
    def from_bytes(data: bytes) -> "Image":
        """Loads image from image bytes.

        Args:
            data: Image bytes.

        Returns:
            Loaded image as an `Image` object.
        """
        image = Image()
        image._image_bytes = data
        return image

    @property
    def _pil_image(self) -> "PIL.Image":
        if self._loaded_image is None:
            if not PIL:
                raise RuntimeError(
                    "The PIL module is not available. Please install the Pillow package."
                )
            self._loaded_image = PIL.open(io.BytesIO(self._image_bytes))
        return self._loaded_image

    @property
    def _mime_type(self) -> str:
        """Returns the MIME type of the image."""
        # if PIL:
        #     return _FORMAT_TO_MIME_TYPE[self._pil_image.format.lower()]
        # else:
        #     # Fall back to jpeg
        return "image/jpeg"

    @property
    def data(self) -> bytes:
        """Returns the image data."""
        return self._image_bytes

    @property
    def base64_data(self) -> str:
        """Returns the image data encoded as a base64 string."""
        return base64.b64encode(self._image_bytes).decode("utf-8")

    def _repr_png_(self):
        return self._pil_image._repr_png_()


def get_image_description_from_groq(
    image: Image,
) -> str:
    """
    encode our image to a base64 format string
    """
    chat_completion = groq_client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": image_description_prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image.base64_data}",
                        },
                    },
                ],
            }
        ],
        model=GroqModels.LLAMA_3_VISION_PREVIEW.value,
    )

    return chat_completion.choices[0].message.content
