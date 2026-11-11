#!/usr/bin/env python3
"""Lossless optional instrument XML insertion and exclusive output custody."""
import os
from xml.parsers import expat


def insert_selected_rigid_losslessly(original, checked, require):
    """Insert Rigid only at source-bound byte positions; preserve all other bytes.

    ElementTree supplies the semantically validated anchors, but must never
    serialize a selected revision: it strips comments/BOM and rewrites prefixes.
    """
    try:
        original.decode("utf-8-sig")
    except UnicodeError:
        require(False, "INSTRUMENT_LOSSLESS_UTF8_REQUIRED")
    targets = {(row["branchOccurrenceIndex"], row["endSourceNodeOrdinal"])
               for row in checked}
    require(len(targets) == len(checked), "INSTRUMENT_LOSSLESS_TARGET_COLLISION")
    parser = expat.ParserCreate()
    stack, insertions = [], {}
    branch_index = -1

    def on_start(qname, _attributes):
        nonlocal branch_index
        local = qname.rsplit(":", 1)[-1]
        frame = {"qname": qname, "local": local}
        if local == "Branch":
            branch_index += 1
            frame["branch"] = branch_index
            frame["next_node"] = 0
        if local == "Node" and stack and stack[-1]["local"] == "Branch":
            parent = stack[-1]
            identity = (parent["branch"], parent["next_node"])
            parent["next_node"] += 1
            if identity in targets:
                frame["target"] = identity
        stack.append(frame)

    def on_end(qname):
        frame = stack.pop()
        require(frame["qname"] == qname, "INSTRUMENT_LOSSLESS_STRUCTURE_DRIFT")
        identity = frame.get("target")
        if identity is None:
            return
        offset = parser.CurrentByteIndex
        closing = ("</" + qname + ">").encode("utf-8")
        require(original[offset:offset + len(closing)] == closing,
                "INSTRUMENT_LOSSLESS_NODE_CLOSING_UNVERIFIED")
        prefix = qname.rpartition(":")[0]
        rigid = (prefix + ":" if prefix else "") + "Rigid"
        insertion = ("<" + rigid + ">2</" + rigid + ">").encode("utf-8")
        require(identity not in insertions, "INSTRUMENT_LOSSLESS_TARGET_COLLISION")
        insertions[identity] = (offset, insertion)

    parser.StartElementHandler = on_start
    parser.EndElementHandler = on_end
    try:
        parser.Parse(original, True)
    except expat.ExpatError:
        require(False, "INSTRUMENT_LOSSLESS_XML_PARSE_FAILED")
    require(set(insertions) == targets, "INSTRUMENT_LOSSLESS_TARGET_NOT_FOUND")
    revised = original
    for offset, insertion in sorted(insertions.values(), reverse=True):
        revised = revised[:offset] + insertion + revised[offset:]
    return revised


def write_outputs_exclusively(outputs):
    """Exclusive, synced creation; rollback only inodes owned by this call."""
    created = []
    try:
        for path, payload in outputs:
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            owned = os.fstat(fd)
            created.append((path, owned.st_dev, owned.st_ino))
            with os.fdopen(fd, "wb") as stream:
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
    except OSError:
        for path, device, inode in reversed(created):
            try:
                now = path.lstat()
            except FileNotFoundError:
                continue
            if (now.st_dev, now.st_ino) == (device, inode):
                path.unlink(missing_ok=True)
        raise

