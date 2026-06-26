import { NextRequest, NextResponse } from "next/server";

import { createAssetQrSvg } from "@/lib/asset-qr";
import { getCurrentUser } from "@/lib/auth";
import { getAssetById } from "@/lib/assets";
import { canAccessFacility } from "@/lib/facility-scope";

type DownloadQrRequest = {
  ids?: unknown;
  filename?: unknown;
};

type ZipEntry = {
  name: string;
  data: Buffer;
};

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(data: Buffer) {
  let value = 0xffffffff;
  for (const byte of data) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function getDosTimestamp(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function createZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { time, date } = getDosTimestamp();

  for (const entry of entries) {
    const filename = Buffer.from(entry.name, "utf8");
    const checksum = crc32(entry.data);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(filename.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, filename, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(filename.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, filename);

    offset += localHeader.length + filename.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

function sanitizeFilename(value: string, fallback: string) {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120);
  return cleaned || fallback;
}

function encodeContentDispositionFilename(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DownloadQrRequest;
  try {
    body = (await req.json()) as DownloadQrRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!Array.isArray(body.ids)) {
    return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
  }

  const ids = [...new Set(body.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) {
    return NextResponse.json({ error: "No assets selected" }, { status: 400 });
  }

  const assets = (await Promise.all(ids.map((id) => getAssetById(id)))).filter((asset) => asset !== null);
  if (assets.length === 0) {
    return NextResponse.json({ error: "Assets not found" }, { status: 404 });
  }

  if (assets.some((asset) => !canAccessFacility(user, asset.facilityId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entries = await Promise.all(
    assets.map(async (asset) => {
      const label = sanitizeFilename(`${asset.assetRegistrationNo || `asset-${asset.id}`} ${asset.assetName}`, `asset-${asset.id}`);
      const svg = await createAssetQrSvg(asset, req.url);
      return {
        name: `${label}.svg`,
        data: Buffer.from(svg, "utf8"),
      };
    })
  );

  const zip = createZip(entries);
  const requestedName = typeof body.filename === "string" ? body.filename : "atacs-asset-qr";
  const zipFilename = `${sanitizeFilename(requestedName, "atacs-asset-qr")}.zip`;

  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": encodeContentDispositionFilename(zipFilename),
      "Cache-Control": "private, no-store",
    },
  });
}
