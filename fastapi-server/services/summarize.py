import os
import time
from typing import List, Dict, Any, Optional, Callable
from concurrent.futures import ThreadPoolExecutor
import groq
from tiktoken import get_encoding
from llama_index.core.schema import Document as LlamaIndexDocument
from core.config import settings
from utils.defaults import GroqModels
from utils.text_splitter import SentenceSplitter
from utils.vector_store import AttachmentVectorSpace

# Set up Groq client
groq_client = groq.Client(api_key=settings.GROQ_API_KEY)

# Tiktoken encoder for token counting
encoder = get_encoding("cl100k_base")  # OpenAI's encoding works well for most LLMs

# Llamaindex text splitter
sentence_splitter = SentenceSplitter(
    chunk_size=8000, chunk_overlap=200, paragraph_separator="\n\n"
)

DEFAULT_MAP_PROMPT = """
You are an expert summarizer. Your task is to create a concise and comprehensive
summary of the following text, capturing all the key information and main points.

TEXT TO SUMMARIZE:
{text}

SUMMARY:
"""

DEFAULT_REDUCE_PROMPT = """
You are an expert summarizer. Your task is to create a comprehensive summary from the
following collection of summaries. Each summary is from a different section of a larger document.

Combine these summaries into a single coherent summary that covers all the key points and
maintains the context and flow of information. Make sure to avoid redundancy while preserving
important details.

SUMMARIES TO COMBINE:
{summaries}

FINAL SUMMARY:
"""


class DocumentSummarizer:

    def __init__(
        self,
        user_id: str,
        file_id: str,
        llm_model: str = GroqModels.LLAMA_3_70B_VERSATILE.value,
        verbose: bool = False,
    ):
        self.user_id = user_id
        self.file_id = file_id
        self.llm_model = llm_model
        self.verbose = verbose

    def get_num_tokens(self, text: str) -> int:
        """Count the number of tokens in a text string."""
        return len(encoder.encode(text))

    def get_num_tokens_from_documents(self, documents: List[LlamaIndexDocument]) -> int:
        """Count the number of tokens in a list of documents."""
        total_tokens = 0
        for doc in documents:
            total_tokens += self.get_num_tokens(doc.get_content("embed"))
        return total_tokens

    def call_groq_llm(
        self,
        model: str,
        prompt: str,
        temperature: float = 0.0,
        max_completion_tokens: int = 3000,
    ) -> str:
        """
        Call Groq LLM with the given prompt and parameters.

        Args:
            prompt: The prompt to send to the LLM
            model: Groq model to use
            temperature: Temperature for generation (lower = more deterministic)
            max_tokens: Maximum number of tokens to generate

        Returns:
            Generated text
        """
        try:
            response = groq_client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_completion_tokens=max_completion_tokens,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error calling Groq API: {e}")
            # Implement retry logic here if needed
            raise

    def map_reduce_summarize(
        self,
        pages: List[LlamaIndexDocument],
        map_prompt_template: str,
        reduce_prompt_template: str,
        chunk_size: int = 3000,
        chunk_overlap: int = 100,
        map_model: str = GroqModels.LLAMA_3_70B_VERSATILE.value,
        reduce_model: str = GroqModels.LLAMA_3_70B_VERSATILE.value,
        max_workers: int = 4,
        verbose: bool = False,
    ) -> str:
        """
        Perform map-reduce summarization on a document.

        Args:
            document: The document to summarize
            map_prompt_template: Template for map phase (must contain {text})
            reduce_prompt_template: Template for reduce phase (must contain {summaries})
            chunk_size: Size of each chunk in tokens
            chunk_overlap: Overlap between chunks in tokens
            map_model: Model to use for map phase
            reduce_model: Model to use for reduce phase
            max_workers: Maximum number of concurrent workers for map phase
            verbose: Whether to print progress information

        Returns:
            Final summary
        """
        # if verbose:
        #     print(
        #         f"Document length: {len(documents)} characters, ~{self.num_tokens()} tokens"
        #     )

        # Split the document into chunks
        chunks = sentence_splitter.get_nodes_from_documents(
            pages, chunk_size=chunk_size, chunk_overlap=chunk_overlap
        )

        if verbose:
            print(f"Split into {len(chunks)} chunks")

        # MAP PHASE: Summarize each chunk in parallel
        chunk_summaries = []

        def process_chunk(chunk: str) -> str:
            prompt = map_prompt_template.format(text=chunk)
            return self.call_groq_llm(
                prompt=prompt, model=map_model, max_completion_tokens=chunk_size
            )

        start_time = time.time()

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            chunk_summaries = list(
                executor.map(
                    process_chunk, [chunk.get_content("embed") for chunk in chunks]
                )
            )

        if verbose:
            map_time = time.time() - start_time
            print(f"Map phase completed in {map_time:.2f}s")

        # REDUCE PHASE: Combine all summaries
        summaries_text = "\n\n".join(
            [f"Summary {i+1}:\n{summary}" for i, summary in enumerate(chunk_summaries)]
        )
        reduce_prompt = reduce_prompt_template.format(summaries=summaries_text)

        start_time = time.time()
        final_summary = self.call_groq_llm(prompt=reduce_prompt, model=reduce_model)

        if verbose:
            reduce_time = time.time() - start_time
            print(f"Reduce phase completed in {reduce_time:.2f}s")

        return final_summary

    def process_pages(
        self,
        pages: List[LlamaIndexDocument],
        map_prompt: Optional[str] = None,
        reduce_prompt: Optional[str] = None,
        **kwargs,
    ) -> str:
        """
        Summarize a document from a file.

        Args:
            pages: List of llama index documents to summarize
            map_prompt: Custom map prompt (optional)
            reduce_prompt: Custom reduce prompt (optional)
            **kwargs: Additional arguments for map_reduce_summarize

        Returns:
            Final summary
        """
        # Use default prompts if not provided
        map_prompt = map_prompt or DEFAULT_MAP_PROMPT
        reduce_prompt = reduce_prompt or DEFAULT_REDUCE_PROMPT

        # Run map-reduce summarization
        return self.map_reduce_summarize(
            pages=pages,
            map_prompt_template=map_prompt,
            reduce_prompt_template=reduce_prompt,
            **kwargs,
        )


# summary = summarize_document_from_file(
#     file_path="paper_1_output.md",
#     map_prompt=DEFAULT_MAP_PROMPT,
#     reduce_prompt=DEFAULT_REDUCE_PROMPT,
# )
