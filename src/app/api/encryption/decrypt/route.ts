import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/encryption";

interface DecryptRequestBody {
  encryptedString?: string;
  key?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: DecryptRequestBody = await req.json();
    const { encryptedString, key } = body;

    if (!encryptedString || !key) {
      return NextResponse.json(
        { error: true, message: "Key or Encrypted Flag has not been provided" },
        { status: 404 }
      );
    }

    const decryptedData = decrypt(encryptedString, key);

    return NextResponse.json(
      {
        error: false,
        message: "Successful decryption",
        data: decryptedData,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: true, message: "Decryption failed" },
      { status: 500 }
    );
  }
}
