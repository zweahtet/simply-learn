from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union, Iterable

import pymupdf
from pymupdf4llm import to_markdown
from pymupdf import Document as FitzDocument


from llama_index.core.readers.base import BaseReader
from llama_index.core.schema import Document as LlamaIndexDocument


class PDFMarkdownReader(BaseReader):
    """Read PDF files using PyMuPDF library."""

    meta_filter: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None

    def __init__(
        self,
        meta_filter: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None,
    ):
        self.meta_filter = meta_filter

    def load_data(
        self,
        file_path: Union[Path, str],
        image_path: Union[Path, str],
        extra_metadata: Dict[str, Any],
        **kwargs: Any,
    ) -> List[LlamaIndexDocument]:
        """Loads list of documents from PDF file and also accepts extra information in dict format.

        Args:
            file_path (Union[Path, str]): The path to the PDF file.
            **load_kwargs (Any): Additional keyword arguments to be passed to the load method.

        Returns:
            List[LlamaIndexDocument]: A list of LlamaIndexDocument objects.
        """
        if not isinstance(file_path, str) and not isinstance(file_path, Path):
            raise TypeError("file_path must be a string or Path.")

        pages = to_markdown(
            file_path,
            write_images=True,
            image_path=image_path,
            image_format="jpg",
            page_chunks=True,
        )

        llama_index_docs = [
            LlamaIndexDocument(
                text=page["text"],
                metadata=self._extract_doc_meta(page, extra_metadata),
                text_template="Metadata: {metadata_str}\n-----\nContent: {content}",
                excluded_embed_metadata_keys=["user_id"]
            ) for page in pages
        ]

        return llama_index_docs

    def _extract_doc_meta(
        self,
        doc: Dict[str, Any],
        extra_metadata: Dict[str, Any] = None,
    ):
        """Extract metas of a PDF document.
        
        Args:
            doc (Dict[str, Any]): A dictionary containing document metadata given by to_markdown function.
        """
        doc_metadata = {
            "title": doc["metadata"].get("title", ""),
            "author": doc["metadata"].get("author", ""),
            "subject": doc["metadata"].get("subject", ""),
            "keywords": doc["metadata"].get("keywords", ""),
            "page": doc["metadata"].get("page", ""),
            "page_count": doc["metadata"].get("page_count", ""),
            "images": str(doc.get("images")),
            "toc_items": str(doc.get("toc_items")),
        }

        extra_metadata.update(doc_metadata)

        return extra_metadata
