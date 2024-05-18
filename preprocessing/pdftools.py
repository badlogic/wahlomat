import fitz

def column_boxes(page, footer_margin=50, header_margin=50, no_image_text=True):
    paths = page.get_drawings()
    bboxes = []
    path_rects = []
    img_bboxes = []
    vert_bboxes = []

    clip = +page.rect
    clip.y1 -= footer_margin
    clip.y0 += header_margin

    def can_extend(temp, bb, bboxlist):
        for b in bboxlist:
            if not intersects_bboxes(temp, vert_bboxes) and (
                b == None or b == bb or (temp & b).is_empty
            ):
                continue
            return False

        return True

    def in_bbox(bb, bboxes):
        for i, bbox in enumerate(bboxes):
            if bb in bbox:
                return i + 1
        return 0

    def intersects_bboxes(bb, bboxes):
        for bbox in bboxes:
            if not (bb & bbox).is_empty:
                return True
        return False

    def extend_right(bboxes, width, path_bboxes, vert_bboxes, img_bboxes):
        for i, bb in enumerate(bboxes):
            if in_bbox(bb, path_bboxes):
                continue

            if in_bbox(bb, img_bboxes):
                continue

            temp = +bb
            temp.x1 = width

            if intersects_bboxes(temp, path_bboxes + vert_bboxes + img_bboxes):
                continue

            check = can_extend(temp, bb, bboxes)
            if check:
                bboxes[i] = temp

        return [b for b in bboxes if b != None]

    def clean_nblocks(nblocks):
        """Do some elementary cleaning."""

        blen = len(nblocks)
        if blen < 2:
            return nblocks
        start = blen - 1
        for i in range(start, -1, -1):
            bb1 = nblocks[i]
            bb0 = nblocks[i - 1]
            if bb0 == bb1:
                del nblocks[i]

        y1 = nblocks[0].y1
        i0 = 0
        i1 = -1

        for i in range(1, len(nblocks)):
            b1 = nblocks[i]
            if abs(b1.y1 - y1) > 10:
                if i1 > i0:
                    nblocks[i0 : i1 + 1] = sorted(
                        nblocks[i0 : i1 + 1], key=lambda b: b.x0
                    )
                y1 = b1.y1
                i0 = i
            i1 = i
        if i1 > i0:
            nblocks[i0 : i1 + 1] = sorted(nblocks[i0 : i1 + 1], key=lambda b: b.x0)
        return nblocks

    for p in paths:
        path_rects.append(p["rect"].irect)
    path_bboxes = path_rects

    path_bboxes.sort(key=lambda b: (b.y0, b.x0))

    for item in page.get_images():
        img_bboxes.extend(page.get_image_rects(item[0]))

    blocks = page.get_text(
        "dict",
        flags=fitz.TEXTFLAGS_TEXT,
        clip=clip,
    )["blocks"]

    for b in blocks:
        bbox = fitz.IRect(b["bbox"])

        if no_image_text and in_bbox(bbox, img_bboxes):
            continue

        line0 = b["lines"][0]  # get first line
        if line0["dir"] != (1, 0):  # only accept horizontal text
            vert_bboxes.append(bbox)
            continue

        srect = fitz.EMPTY_IRECT()
        for line in b["lines"]:
            lbbox = fitz.IRect(line["bbox"])
            text = "".join([s["text"].strip() for s in line["spans"]])
            if len(text) > 1:
                srect |= lbbox
        bbox = +srect

        if not bbox.is_empty:
            bboxes.append(bbox)

    # Sort text bboxes by ascending background, top, then left coordinates
    bboxes.sort(key=lambda k: (in_bbox(k, path_bboxes), k.y0, k.x0))

    # Extend bboxes to the right where possible
    bboxes = extend_right(
        bboxes, int(page.rect.width), path_bboxes, vert_bboxes, img_bboxes
    )

    # immediately return of no text found
    if bboxes == []:
        return []

    # --------------------------------------------------------------------
    # Join bboxes to establish some column structure
    # --------------------------------------------------------------------
    # the final block bboxes on page
    nblocks = [bboxes[0]]  # pre-fill with first bbox
    bboxes = bboxes[1:]  # remaining old bboxes

    for i, bb in enumerate(bboxes):  # iterate old bboxes
        check = False  # indicates unwanted joins

        # check if bb can extend one of the new blocks
        for j in range(len(nblocks)):
            nbb = nblocks[j]  # a new block

            # never join across columns
            if bb == None or nbb.x1 < bb.x0 or bb.x1 < nbb.x0:
                continue

            # never join across different background colors
            if in_bbox(nbb, path_bboxes) != in_bbox(bb, path_bboxes):
                continue

            temp = bb | nbb  # temporary extension of new block
            check = can_extend(temp, nbb, nblocks)
            if check == True:
                break

        if not check:  # bb cannot be used to extend any of the new bboxes
            nblocks.append(bb)  # so add it to the list
            j = len(nblocks) - 1  # index of it
            temp = nblocks[j]  # new bbox added

        # check if some remaining bbox is contained in temp
        check = can_extend(temp, bb, bboxes)
        if check == False:
            nblocks.append(bb)
        else:
            nblocks[j] = temp
        bboxes[i] = None

    # do some elementary cleaning
    nblocks = clean_nblocks(nblocks)

    # return identified text bboxes
    return nblocks


def convert_pdf(filename, footer_margin = 50, header_margin = 50):
    doc = fitz.open(filename)
    text = ""
    page_num = 1

    for page in doc:
        page.wrap_contents()
        bboxes = column_boxes(page, footer_margin=footer_margin, header_margin=header_margin)
        page_text = ""
        for i, rect in enumerate(bboxes):
            page_text += page.get_text(clip=rect, sort=True) + "\n"

        text += "========== PAGE " + str(page_num) + "\n" + page_text
        page_num += 1

    return text

def write_file(filename, text):
    with open(filename, "w") as file:
        file.write(text)

def read_file(filename):
    with open(filename, 'r') as file:
        return file.read()
