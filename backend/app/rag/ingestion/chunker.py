from dataclasses import dataclass
from typing import List, Optional, Tuple


@dataclass
class IngestionChunk:
    """Represents a split, normalized document passage ready for embedding."""

    chunk_index: int
    chunk_text: str
    page_number: Optional[int]
    char_start: int
    char_end: int


def split_text_into_chunks(
    text: str,
    page_number: Optional[int] = None,
    chunk_size: int = 800,
    chunk_overlap: int = 150,
    start_index: int = 0,
) -> List[IngestionChunk]:
    """
    Split a continuous string into overlapping character chunks.
    Attempts to respect paragraph and sentence boundaries within the window.
    """
    if not text.strip():
        return []

    # Guard against invalid overlap parameters
    if chunk_overlap >= chunk_size:
        chunk_overlap = max(0, chunk_size // 4)

    # If text is already smaller than or equal to chunk_size, return as single chunk
    if len(text) <= chunk_size:
        return [
            IngestionChunk(
                chunk_index=start_index,
                chunk_text=text.strip(),
                page_number=page_number,
                char_start=0,
                char_end=len(text),
            )
        ]

    chunks: List[IngestionChunk] = []
    start = 0
    curr_index = start_index

    while start < len(text):
        end = min(start + chunk_size, len(text))

        # If not at the end of text, attempt to find a clean break point
        if end < len(text):
            # Try to break at a paragraph break first
            last_para = text.rfind("\n\n", start + chunk_overlap, end)
            if last_para != -1:
                end = last_para + 2
            else:
                # Try sentence end (. followed by whitespace)
                last_sentence = text.rfind(". ", start + chunk_overlap, end)
                if last_sentence != -1:
                    end = last_sentence + 2
                else:
                    # Try newline
                    last_nl = text.rfind("\n", start + chunk_overlap, end)
                    if last_nl != -1:
                        end = last_nl + 1
                    else:
                        # Try space
                        last_space = text.rfind(" ", start + chunk_overlap, end)
                        if last_space != -1:
                            end = last_space + 1

        chunk_slice = text[start:end].strip()
        if chunk_slice:
            chunks.append(
                IngestionChunk(
                    chunk_index=curr_index,
                    chunk_text=chunk_slice,
                    page_number=page_number,
                    char_start=start,
                    char_end=end,
                )
            )
            curr_index += 1

        if end >= len(text):
            break

        # Advance start with overlap
        start = max(end - chunk_overlap, start + 1)

    return chunks


def chunk_document_pages(
    pages: List[Tuple[Optional[int], str]],
    chunk_size: int = 800,
    chunk_overlap: int = 150,
) -> List[IngestionChunk]:
    """
    Split page-indexed passages into a globally ordered sequence of chunks,
    preserving each chunk's origin page number.
    """
    all_chunks: List[IngestionChunk] = []
    global_index = 0

    for page_num, page_text in pages:
        page_chunks = split_text_into_chunks(
            text=page_text,
            page_number=page_num,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            start_index=global_index,
        )
        all_chunks.extend(page_chunks)
        global_index += len(page_chunks)

    return all_chunks
