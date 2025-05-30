import json
import uuid
import time
import groq
from pathlib import Path


from qdrant_client import QdrantClient
from typing import List, Dict, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, Future
from tiktoken import get_encoding
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.schema import Document as LlamaIndexDocument

from core.config import settings
from utils.defaults import GroqModels
from utils.embeddings import get_dense_embedding_model
from utils.text_splitter import get_sentence_splitter
from utils.vector_store import AttachmentVectorSpace
from schemas import CognitiveProfile

# Tiktoken encoder for token counting
encoder = get_encoding("cl100k_base")

# Initialize Groq client
groq_client = groq.Client(
    api_key=settings.GROQ_API_KEY,
)

# Initialize Qdrant client
qdrant_client = QdrantClient(
    url=settings.QDRANT_HOST_URL,
    api_key=settings.QDRANT_API_KEY,
)
qdrant_client.set_model(
    embedding_model_name=get_dense_embedding_model().model_name,
    cache_dir=settings.FASTEMBED_MODELS_CACHE_DIR,
)

DEFAULT_MODEL = GroqModels.LLAMA_3_70B_VERSATILE.value  # 32,768 max completion tokens

# Cognitive domains in the 5-cog approach
COGNITIVE_DOMAINS = ["attention", "memory", "visuospatial", "language", "executive"]


class SimplificationProgress:
    """Tracks simplification progress and provides updates"""

    def __init__(self):
        self.progress = {}

    def create_task(self, file_id, total_chunks):
        """Initialize a new simplification task"""
        self.progress[file_id] = {
            "total_chunks": total_chunks,
            "processed_chunks": 0,
            "simplified_chunks": {},
            "completed": False,
            "error": None,
        }

    def update_chunk(self, file_id, chunk_index, simplified_content):
        """Update a simplified chunk"""
        if file_id not in self.progress:
            return

        self.progress[file_id]["simplified_chunks"][chunk_index] = simplified_content
        self.progress[file_id]["processed_chunks"] += 1

        if (
            self.progress[file_id]["processed_chunks"]
            >= self.progress[file_id]["total_chunks"]
        ):
            self.progress[file_id]["completed"] = True

    def get_progress(self, file_id):
        """Get current progress for a file"""
        if file_id not in self.progress:
            return None
        return self.progress[file_id]

    def set_error(self, file_id, error_message):
        """Set error for a file"""
        if file_id in self.progress:
            self.progress[file_id]["error"] = error_message


# Create a global instance
simplification_progress = SimplificationProgress()

class TextSimplificationAgent:
    """Agent that orchestrates the cognitive simplification process with vector DB support."""

    def __init__(
        self,
        user_id: str,
        file_id: str,
        model: str = DEFAULT_MODEL,
        verbose: bool = False,
    ):
        self.model = model
        self.verbose = verbose
        self.attachment_vector_space = AttachmentVectorSpace()
        self.user_id = user_id
        self.file_id = file_id

        # Create or get ChromaDB collection
        # if collection_name is None:
        #     collection_name = f"doc_chunks_{uuid.uuid4().hex[:8]}"

        # self.collection = chroma_client.get_or_create_collection(
        #     name=collection_name, embedding_function=embedding_function
        # )

    def log(self, message: str):
        """Print log message if verbose mode is enabled."""
        if self.verbose:
            print(message)

    def num_tokens(self, text: str) -> int:
        """Count the number of tokens in a text string."""
        return len(encoder.encode(text))

    def call_groq_llm(
        self, prompt: str, temperature: float = 0.0, max_completion_tokens: int = 5000
    ) -> str:
        """Call Groq LLM with the given prompt and parameters."""
        try:
            response = groq_client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_completion_tokens=max_completion_tokens,
            )
            return response.choices[0].message.content
        except Exception as e:
            self.log(f"Error calling Groq API: {e}")
            # Simple retry logic
            try:
                time.sleep(2)  # Wait before retry
                response = groq_client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_completion_tokens=max_completion_tokens,
                )
                return response.choices[0].message.content
            except Exception as retry_error:
                self.log(f"Retry failed: {retry_error}")
                raise

    def validate_cognitive_profile(self, profile: Dict[str, int]) -> Dict[str, int]:
        """
        Validates and normalizes a cognitive profile.

        Args:
            profile: Dictionary with cognitive domains as keys and levels (1-5) as values

        Returns:
            Validated profile with all necessary domains
        """
        validated_profile = {}

        # Ensure all domains are present with valid values
        for domain in COGNITIVE_DOMAINS:
            if domain in profile:
                # Ensure values are between 1-5
                level = max(1, min(5, profile[domain]))
            else:
                # Default to level 5 (typical ability) if not specified
                level = 5

            validated_profile[domain] = level

        return validated_profile

    def get_domain_prompt(self, domain: str, level: int, text: str) -> str:
        """Generate a domain-specific prompt for text simplification."""
        # Base prompt structure
        prompt_base = f"""
        You are an expert in adapting text for people with different cognitive abilities.
        Your task is to modify the following text to make it more accessible for someone 
        with a level {level} out of 5 in the cognitive domain of {domain.upper()}.

        Level 1 means significant challenges in this area, while level 5 means typical ability.
        
        ORIGINAL TEXT:
        {text}
        
        SPECIFIC GUIDELINES FOR {domain.upper()} (Level {level}/5):
        """

        # Domain-specific guidelines
        domain_guidelines = {
            "attention": {
                1: "The person has severe difficulty maintaining focus. Create very short paragraphs (2-3 sentences maximum). Use bullet points extensively. Bold the most important 1-2 words in each paragraph. Eliminate all non-essential information. Include frequent attention resets with clear section headers.",
                2: "The person struggles with attention. Use short paragraphs (3-4 sentences). Include bullet points for lists. Bold important terms. Remove tangential information. Use clear headings to divide content.",
                3: "The person has moderate attention challenges. Keep paragraphs focused (4-5 sentences). Highlight key points. Use subheadings to break up longer sections. Minimize distractions in the text.",
                4: "The person has mild attention difficulties. Maintain reasonable paragraph length. Use occasional highlighting for emphasis. Ensure good structure with clear transitions.",
                5: "The person has typical attention abilities. Maintain the original paragraph structure but ensure clarity and good organization.",
            },
            "memory": {
                1: "The person has severe memory challenges. Begin with a clear summary of the main points. Repeat key information at the beginning and end of each section. Use consistent terminology throughout. Incorporate memory aids like acronyms or rhymes for important points. Include frequent mini-summaries.",
                2: "The person has significant memory difficulties. Start with a brief overview. Repeat important information. Use consistent terms and phrases. Add reminders of previously mentioned concepts when referencing them.",
                3: "The person has moderate memory challenges. Include summaries at key points. Connect new information to previously mentioned concepts. Maintain consistent terminology. Reinforce important points.",
                4: "The person has mild memory difficulties. Provide occasional recaps of key points. Maintain good connection between ideas. Use consistent terminology for important concepts.",
                5: "The person has typical memory abilities. Ensure logical flow between ideas while maintaining the original content.",
            },
            "visuospatial": {
                1: "The person has severe visuospatial processing challenges. Avoid all spatial metaphors and complex descriptions of physical relationships. Replace visual descriptions with sequential, step-by-step explanations. Use simple, linear descriptions. Suggest replacing any diagrams with numbered lists.",
                2: "The person struggles with visuospatial processing. Simplify spatial descriptions. Present information in linear sequences. Replace complex visual concepts with step-by-step descriptions.",
                3: "The person has moderate visuospatial challenges. Clarify spatial relationships. Support visual descriptions with alternative explanations. Simplify complex visual concepts.",
                4: "The person has mild visuospatial difficulties. Ensure clarity when describing spatial relationships or visual concepts. Provide adequate context for visual references.",
                5: "The person has typical visuospatial abilities. Maintain original descriptions but ensure clarity of visual references.",
            },
            "language": {
                1: "The person has severe language processing challenges. Use vocabulary at around a 3rd-4th grade level. Keep sentences under 8 words when possible. Avoid all idioms, metaphors, and figurative language. Use active voice only. Repeat important terms rather than using pronouns. Define any terms above basic vocabulary.",
                2: "The person struggles with language processing. Use vocabulary at around a 5th-6th grade level. Keep sentences under 12 words when possible. Minimize idioms and figurative language. Prefer active voice. Define specialized terms.",
                3: "The person has moderate language challenges. Use vocabulary at around an 8th grade level. Keep sentences straightforward. Explain idioms and metaphors. Define specialized terminology.",
                4: "The person has mild language difficulties. Use clear, straightforward language. Limit complex sentence structures. Briefly explain specialized terminology.",
                5: "The person has typical language abilities. Maintain original language but ensure clarity and precision.",
            },
            "executive": {
                1: "The person has severe reasoning challenges. Break down complex ideas into explicit, simple steps. Use concrete examples for every abstract concept. Avoid all logical leaps. Explicitly state causes and effects. Avoid conditional statements when possible; when necessary, present them as step-by-step scenarios.",
                2: "The person struggles with reasoning tasks. Provide step-by-step explanations for complex ideas. Include examples for abstract concepts. Make logical connections explicit. Clarify cause and effect relationships.",
                3: "The person has moderate reasoning challenges. Break down multi-step processes. Support abstract ideas with examples. Make key logical connections explicit. Clarify complex relationships.",
                4: "The person has mild reasoning difficulties. Ensure logical flow is clear. Provide occasional examples for complex concepts. Make important causal relationships explicit.",
                5: "The person has typical reasoning abilities. Maintain original complexity but ensure logical clarity.",
            },
        }

        # Get the specific guidelines for the domain and level
        specific_guidelines = domain_guidelines[domain][level]

        # Complete the prompt
        prompt = (
            prompt_base
            + specific_guidelines
            + """
            IMPORTANT: While adapting the text, make sure to preserve ALL key information, facts, and concepts 
            from the original text. Do not omit important details even when simplifying.
            
            Please rewrite the text following these guidelines. Preserve all the important information 
            while making the text more accessible for someone with this cognitive profile.
            
            ADAPTED TEXT:
            """.strip()
        )

        return prompt

    def detect_information_loss(
        self, original_chunk: str, simplified_chunk: str
    ) -> Tuple[bool, List[str]]:
        """
        Detect if important information was lost during simplification.

        Args:
            original_chunk: Original text chunk
            simplified_chunk: Simplified text chunk

        Returns:
            Tuple of (has_loss, missing_elements)
        """
        # Use LLM to identify potential information loss
        prompt = f"""
You are an expert content auditor. Your task is to identify any important information, concepts, 
facts, or details that were present in the original text but missing from the simplified version.

Focus on substantive information loss only - style changes, sentence restructuring, and vocabulary 
simplification are expected and acceptable as long as the key information is preserved.

ORIGINAL TEXT:
{original_chunk}

SIMPLIFIED TEXT:
{simplified_chunk}

List ONLY the specific facts, numbers, concepts, or key details that are in the original text but 
completely missing from the simplified text. If no important information is missing, respond with "No important information lost."

MISSING INFORMATION (be specific and concise):
"""

        response = self.call_groq_llm(prompt)

        # Check if anything important was lost
        if "no important information lost" in response.lower():
            return False, []

        # Extract the missing elements
        missing_elements = [
            item.strip() for item in response.split("\n") if item.strip()
        ]
        return True, missing_elements

    # FIXME: this is not working properfly, seem not retrieving contexts
    def retrieve_relevant_context(
        self,
        missing_elements: List[str],
        top_k: int = 3,
    ) -> List[str]:
        """
        Retrieve relevant context from vector DB for the missing elements.

        Args:
            file_id: ID of the file to retrieve from
            missing_elements: List of missing information elements
            top_k: Number of most relevant chunks to retrieve

        Returns:
            List of relevant text chunks
        """
        # Combine missing elements into a query
        query = " ".join(missing_elements)

        results = self.attachment_vector_space.retrieve_documents(
            query=query,
            n_results=top_k,
            filter={"user_id": self.user_id, "file_id": self.file_id},
        )

        # Extract the relevant chunks
        if results:
            return [doc.get_content("embed") for doc in results]

        return []

    def reincorporate_missing_information(
        self,
        simplified_chunk: str,
        missing_elements: List[str],
        context_chunks: List[str],
        cognitive_profile: CognitiveProfile,
    ) -> str:
        """
        Reincorporate missing information in a cognitively appropriate way.

        Args:
            simplified_chunk: Already simplified text
            missing_elements: List of missing information
            context_chunks: Retrieved context chunks
            cognitive_profile: Cognitive profile

        Returns:
            Updated simplified text with missing information reincorporated
        """
        # Combine retrieved context
        context = "\n\n".join(context_chunks)

        # Create a prompt for reincorporation
        missing_info = "\n".join([f"- {item}" for item in missing_elements])

        prompt = f"""
You are an expert in adapting text for people with different cognitive abilities.

The following text has already been simplified for someone with this cognitive profile:
{cognitive_profile.model_dump_json(indent=2)}

However, some important information has been lost during simplification. Your task is to
reincorporate this missing information while maintaining the accessibility of the text.

CURRENT SIMPLIFIED TEXT:
{simplified_chunk}

MISSING INFORMATION THAT NEEDS TO BE ADDED:
{missing_info}

RELEVANT CONTEXT FROM ORIGINAL DOCUMENT:
{context}

Please update the simplified text to include the missing information in a way that:
1. Maintains the appropriate level of simplification for each cognitive domain
2. Preserves the structure and formatting of the current simplified text
3. Seamlessly integrates the missing information where most relevant
4. Does not add unnecessary complexity or tangential information

UPDATED SIMPLIFIED TEXT:
"""

        return self.call_groq_llm(prompt)

    def simplify_text_for_cognitive_domain(
        self, text: str, domain: str, level: int
    ) -> str:
        """
        Simplify text for a specific cognitive domain and level.

        Args:
            text: Text to simplify
            domain: Cognitive domain
            level: Cognitive level (1-5)

        Returns:
            Simplified text
        """
        prompt = self.get_domain_prompt(domain, level, text)
        return self.call_groq_llm(prompt)

    def process_chunk_with_context_retrieval(
        self, original_chunk: str, cognitive_profile: CognitiveProfile, chunk_index: int
    ) -> str:
        """
        Process a single chunk with context retrieval for lost information.

        Args:
            original_chunk: Original text chunk
            cognitive_profile: Cognitive profile
            chunk_index: Index of the chunk in the document

        Returns:
            Processed chunk
        """
        self.log(f"Processing chunk {chunk_index}")

        profile_dict = cognitive_profile.model_dump()

        # Identify domains that need simplification (level < 5)
        domains_to_simplify = [
            domain for domain, level in profile_dict.items() if level < 5
        ]

        # Start with the original text
        current_text = original_chunk

        # Apply simplification for each domain sequentially
        for domain in domains_to_simplify:
            level = profile_dict.get(domain)
            self.log(f"Simplifying for {domain} (level {level})...")

            current_text = self.simplify_text_for_cognitive_domain(
                current_text, domain, level
            )

        # Check for information loss
        has_loss, missing_elements = self.detect_information_loss(
            original_chunk, current_text
        )

        if has_loss:
            self.log(f"Detected information loss: {len(missing_elements)} elements")
            self.log(f"Missing: {missing_elements[:3]}...")

            # Retrieve relevant context
            context_chunks = self.retrieve_relevant_context(missing_elements)
            self.log(f"Retrieved {len(context_chunks)} relevant context chunks")

            # Reincorporate missing information
            current_text = self.reincorporate_missing_information(
                current_text, missing_elements, context_chunks, cognitive_profile
            )

            self.log("  Reincorporated missing information")
        else:
            self.log("  No significant information loss detected")

        return current_text

    def process_documents(
        self,
        documents: List[LlamaIndexDocument],
        cognitive_profile: CognitiveProfile,
        chunk_size: int = 4000,
        chunk_overlap: int = 100,
        max_workers: int = 4,
    ) -> str:
        """
        Process a document with the agentic cognitive simplification workflow.
        """
        # # Validate cognitive profile
        # profile = self.validate_cognitive_profile(cognitive_profile)

        # Split document into processing chunks
        splitter = get_sentence_splitter(
            chunk_size=chunk_size, chunk_overlap=chunk_overlap
        )
        chunks = splitter.get_nodes_from_documents(documents)

        # Initialize progress tracking
        simplification_progress.create_task(self.file_id, len(chunks))

        # Process each chunk
        simplified_chunks = []

        try:
            # Use ThreadPoolExecutor for parallel processing
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Create futures
                futures: List[Tuple[int, Future]] = []
                for i, chunk in enumerate(chunks):
                    future = executor.submit(
                        self.process_chunk_with_context_retrieval,
                        chunk.get_content("embed"),
                        cognitive_profile,
                        i,
                    )
                    futures.append((i, future))

                # Collect results in order
                for i, future in futures:
                    try:
                        simplified_chunk = future.result()
                        simplified_chunks.append(simplified_chunk)

                        # Update progress
                        simplification_progress.update_chunk(
                            self.file_id, i, simplified_chunk
                        )
                    except Exception as e:
                        self.log(f"Error processing chunk {i}: {e}")
                        # Update error status
                        simplification_progress.set_error(
                            self.file_id, f"Error processing chunk {i}: {str(e)}"
                        )
                        # Continue with other chunks
                        simplified_chunks.append(chunk.get_content("embed"))

            # Final processing - this shouldn't be necessary for streaming
            # but keep it for a final combined document if needed
            combined_document = "\n\n".join(simplified_chunks)
            return combined_document
        except Exception as e:
            simplification_progress.set_error(self.file_id, str(e))
            raise e
