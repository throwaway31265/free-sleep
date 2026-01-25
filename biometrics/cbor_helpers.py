import cbor2
import logging

logger = logging.getLogger('free-sleep-cbor')

def iter_raw_records(f):
    """
    Generator that yields valid Outer Records from the file.
    Handles resyncing if corruption is encountered.
    """
    # Header format: \xa2 (map of 2) \x63 (str of 3) "seq" \x1a (uint32)
    header = b'\xa2\x63\x73\x65\x71\x1a'
    while True:
        pos = f.tell()
        try:
            row = cbor2.load(f)
            if isinstance(row, dict) and 'data' in row:
                yield row
            else:
                # Not a valid record, force a resync from next byte
                f.seek(pos + 1)
        except (EOFError, StopIteration):
            break
        except Exception as error:
            logger.debug(f"Framing error at byte {pos}: {error}. Resyncing...")
            # Resync: search for the next occurrence of the row header
            chunk_size = 4096
            found = False
            while True:
                current_pos = f.tell()
                chunk = f.read(chunk_size)
                if not chunk:
                    break

                idx = chunk.find(header)
                if idx != -1:
                    raw_pos = current_pos + idx
                    f.seek(raw_pos)
                    logger.debug(f"Resynced framing at byte {raw_pos}")
                    found = True
                    break

            if not found:
                break
