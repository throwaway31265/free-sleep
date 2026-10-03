"""Read RAW wrappers without consuming bytes from the next record."""

from io import BytesIO
from typing import BinaryIO, Optional

import cbor2


# Older cbor2 versions read exact lengths and do not accept read_size.
try:
    cbor2.CBORDecoder(BytesIO(), read_size=1)
except TypeError:
    _decoder_options = {}
else:
    _decoder_options = {'read_size': 1}


def read_raw_record(raw_file: BinaryIO) -> Optional[bytes]:
    """Read one wrapper; return None for placeholders and raise EOF on partial writes."""
    try:
        record = cbor2.CBORDecoder(raw_file, **_decoder_options).decode()
    except cbor2.CBORDecodeEOF as error:
        # cbor2 6 no longer makes CBORDecodeEOF a subclass of EOFError.
        raise EOFError('Incomplete RAW record') from error
    if not isinstance(record, dict):
        raise ValueError('Expected a RAW record map')

    payload = record.get('data')
    if payload is None:
        return None
    if not isinstance(payload, bytes):
        raise ValueError('Expected RAW record data to be bytes')
    return payload or None
