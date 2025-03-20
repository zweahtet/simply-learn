from llama_index.core.text_splitter import SentenceSplitter

def get_sentence_splitter(
    chunk_size: int = 1000, chunk_overlap: int = 100
) -> SentenceSplitter:
    """
    Get a sentence splitter for splitting text into sentence and pargraph chunks.
    Args:
        chunk_size (int): Size of each chunk.
        chunk_overlap (int): Overlap between chunks.
        
    Returns:
        SentenceSplitter: A sentence splitter object.
    """
    sentence_splitter = SentenceSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        paragraph_separator="\n\n",
        include_metadata=True,
    )

    return sentence_splitter
