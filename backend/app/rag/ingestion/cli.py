import argparse
import asyncio
import os
import sys
from typing import List
from app.config import get_settings
from app.db.session import get_session_factory
from app.rag.ingestion.extractors import SUPPORTED_EXTENSIONS
from app.rag.ingestion.service import IngestionService


def find_supported_files(target_path: str) -> List[str]:
    """Find all supported documents in a file or directory path."""
    if os.path.isfile(target_path):
        _, ext = os.path.splitext(target_path)
        if ext.lower() in SUPPORTED_EXTENSIONS:
            return [target_path]
        return []

    if os.path.isdir(target_path):
        supported_files: List[str] = []
        for root, _, files in os.walk(target_path):
            for file in sorted(files):
                _, ext = os.path.splitext(file)
                if ext.lower() in SUPPORTED_EXTENSIONS:
                    supported_files.append(os.path.join(root, file))
        return supported_files

    return []


async def run_cli_ingestion(
    target_path: str,
    source_id: str = None,
    source_title: str = None,
    source_url: str = None,
) -> int:
    """Run batch or single file ingestion from CLI."""
    settings = get_settings()
    session_factory = get_session_factory()

    if not os.path.exists(target_path):
        print(f"Error: Target path '{target_path}' does not exist.", file=sys.stderr)
        return 1

    files_to_ingest = find_supported_files(target_path)
    if not files_to_ingest:
        print(
            f"No supported documents found at '{target_path}'. "
            f"Supported extensions: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
            file=sys.stderr,
        )
        return 1

    print("=" * 60)
    print(f"Knowledge Ingestion Pipeline (Model: {settings.EMBEDDING_MODEL})")
    print(f"Found {len(files_to_ingest)} candidate document(s).")
    print("=" * 60)

    success_count = 0
    skipped_count = 0
    error_count = 0

    for file_path in files_to_ingest:
        filename = os.path.basename(file_path)
        print(f"-> Processing: {file_path}")

        try:
            with open(file_path, "rb") as f:
                file_bytes = f.read()

            with session_factory() as db:
                result = await IngestionService.ingest_document(
                    db=db,
                    file_bytes=file_bytes,
                    filename=filename,
                    source_id=source_id if len(files_to_ingest) == 1 else None,
                    source_title=source_title if len(files_to_ingest) == 1 else None,
                    source_url=source_url,
                    settings=settings,
                )

            if result.status == "skipped_unchanged":
                print(f"   [SKIPPED] Identical content already indexed ({result.total_chunks} chunks).")
                skipped_count += 1
            else:
                print(
                    f"   [SUCCESS] Status: {result.status} | Chunks: {result.chunks_created} | "
                    f"Source ID: {result.source_id}"
                )
                success_count += 1

        except Exception as exc:
            print(f"   [FAILED]  {exc.__class__.__name__}: {str(exc)}", file=sys.stderr)
            error_count += 1

    print("=" * 60)
    print(
        f"Ingestion Completed. Total: {len(files_to_ingest)} | "
        f"Indexed/Updated: {success_count} | Skipped: {skipped_count} | Failed: {error_count}"
    )
    print("=" * 60)

    return 1 if error_count > 0 else 0


def main():
    parser = argparse.ArgumentParser(
        description="Ingest documents (PDF, DOCX, TXT, MD) into CareerCompass vector storage."
    )
    parser.add_argument("path", help="Path to file or directory of documents to ingest")
    parser.add_argument("--source-id", default=None, help="Explicit source identifier (single-file only)")
    parser.add_argument("--title", default=None, help="Document title (single-file only)")
    parser.add_argument("--url", default=None, help="Canonical reference URL")

    args = parser.parse_args()

    exit_code = asyncio.run(
        run_cli_ingestion(
            target_path=args.path,
            source_id=args.source_id,
            source_title=args.title,
            source_url=args.url,
        )
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
