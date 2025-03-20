import PIL
import base64
import io
import pathlib
from typing import Optional
from groq import Groq
import redis
from core.config import settings
from utils.defaults import GroqModels
from schemas import CognitiveProfile, ChunkData

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


# def generate_adaptation_prompt(
#     level: str, cognitive_profile: CognitiveProfile = None
# ) -> str:
#     # Base prompt for language level
#     base_prompt = f"""You are an educational content adapter for ESL students at {level} CEFR level. 
#     Your task is to transform educational content to be more accessible while preserving all key information.
#     Use vocabulary and sentence structures appropriate for the {level} proficiency level."""

#     # Customizations based on cognitive profile
#     customizations = []
#     formatting = []

#     # Memory adaptations
#     if cognitive_profile.memory <= 3:
#         customizations.append(
#             """
#             The learner has difficulty with memory, so:
#             - Repeat key terms multiple times
#             - Use mnemonic devices where possible
#             - Create clear associations between new terms and familiar concepts"""
#         )

#         formatting.append(
#             """
#             - Create a "Key Terms" box at the end of each section to reinforce vocabulary
#             - Use bullet points for lists rather than embedding them in paragraphs"""
#         )
#     elif cognitive_profile.memory >= 7:
#         customizations.append(
#             """
#             The learner has strong memory abilities, so:
#             - Feel free to introduce new vocabulary with proper context
#             - Use recall questions to reinforce learning"""
#         )

#     # Attention adaptations
#     if cognitive_profile.attention <= 3:
#         customizations.append(
#             """
#             The learner has limited attention span, so:
#             - Keep paragraphs very short (3-4 sentences maximum)
#             - Break content into many small, focused sections
#             - Use frequent subheadings to structure content"""
#         )

#         formatting.append(
#             """
#             - Add a "Summary" after every 2-3 paragraphs
#             - Use visual markers like ⚠️ or 🔑 to highlight important points"""
#         )
#     elif cognitive_profile.attention >= 7:
#         customizations.append(
#             """
#             The learner has strong attention abilities, so:
#             - You can present longer, cohesive sections of content
#             - Include more detailed explanations where relevant"""
#         )

#     # Language processing adaptations
#     if cognitive_profile.language <= 3:
#         customizations.append(
#             """
#             The learner needs additional language support, so:
#             - Use very simple sentence structures (subject-verb-object)
#             - Avoid idioms, phrasal verbs, and figurative language
#             - Define terms immediately when introduced"""
#         )

#         formatting.append(
#             """
#             - Present definitions in parentheses right after introducing a term
#             - Use simple illustrations or diagrams where possible"""
#         )
#     elif cognitive_profile.language >= 7:
#         customizations.append(
#             """
#             The learner has strong language abilities for their level, so:
#             - You can use more complex sentence structures within their level
#             - Introduce some common idiomatic expressions with explanations"""
#         )

#     # Executive function adaptations
#     if cognitive_profile.executive <= 3:
#         customizations.append(
#             """
#             The learner may need support with concepts and reasoning, so:
#             - Break complex concepts into explicit steps
#             - Provide concrete examples for abstract ideas
#             - Use clear cause-effect language"""
#         )

#         formatting.append(
#             """
#             - Use numbered lists for processes or sequences
#             - Create "If-Then" statements for conditional content"""
#         )
#     elif cognitive_profile.executive >= 7:
#         customizations.append(
#             """
#             The learner has strong reasoning abilities, so:
#             - Present challenging concept relationships
#             - Include questions that require synthesis of information"""
#         )

#     # Combine the base prompt with customizations
#     final_prompt = base_prompt

#     if customizations:
#         final_prompt += (
#             "\n\nBased on the learner's cognitive profile, make these adjustments:"
#             + "".join(customizations)
#         )

#     if formatting:
#         final_prompt += "\n\nUse these formatting approaches:" + "".join(formatting)

#     # Add HTML formatting instructions
#     final_prompt += f"""
#     Format your response with HTML:
#     - Important terms should be wrapped in <strong> tags
#     - Use <p> tags for paragraphs
#     - Use <h3> tags for section headings
#     - Use <ul> and <li> tags for lists
#     - If creating a key terms box, use <div class="key-terms"> to wrap it
#     - If creating a summary, use <div class="summary"> to wrap it
    
#     Preserve all key information while making the text accessible to a {level} level English learner with the specific cognitive profile described.
#     """.strip()

#     return final_prompt


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


# async def adapt_chunk(
#     chunk: ChunkData, level: str, profile: CognitiveProfile, redis_client: redis.Redis
# ) -> ChunkData:
#     """Adapt a chunk of content using Groq"""
#     # Generate cache key
#     cache_key = f"adapt:{chunk.id}:{level}:{profile.memory}:{profile.attention}:{profile.language}:{profile.visual_spatial}:{profile.executive}"

#     # Check cache first
#     cached_content = redis_client.get(cache_key)
#     if cached_content:
#         chunk.adapted_content = cached_content
#         chunk.is_adapted = True
#         return chunk

#     try:
#         # Determine context to include (useful for maintaining coherence)
#         context = f"This is part of a larger document. "
#         if chunk.metadata and "context" in chunk.metadata:
#             context += chunk.metadata["context"]

#         # Regular text content
#         system_prompt = generate_adaptation_prompt(level, profile)
#         content_to_adapt = chunk.content

#         # Call LLM for adaptation
#         response = groq_client.chat.completions.create(
#             model="llama-3.2-70b-versatile",  # Using a versatile model
#             messages=[
#                 {"role": "system", "content": system_prompt},
#                 {"role": "user", "content": f"{context}\n\n{content_to_adapt}"},
#             ],
#             temperature=0.3,
#             max_tokens=1000,
#         )

#         adapted_content = response.choices[0].message.content

#         # Store in cache
#         redis_client.set(cache_key, adapted_content, ex=CACHE_TTL)

#         # Update chunk
#         chunk.adaptedContent = adapted_content
#         chunk.isAdapted = True

#     except Exception as e:
#         print(f"Error adapting chunk {chunk.id}: {e}")
#         # In case of error, return original content with an error flag
#         chunk.adaptedContent = chunk.content
#         chunk.isAdapted = False
#         chunk.metadata = chunk.metadata or {}
#         chunk.metadata["error"] = str(e)

#     return chunk
