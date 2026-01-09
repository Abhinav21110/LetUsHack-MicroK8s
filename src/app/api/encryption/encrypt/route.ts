import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";

interface EncryptRequestBody {
  inputString?: string;
  key?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: EncryptRequestBody = await req.json();
    const { inputString, key } = body;

    if (!inputString || !key) {
      return NextResponse.json(
        { error: true, message: "Key or inputString has not been provided" },
        { status: 400 }
      );
    }

    const encryptedData = encrypt(inputString, key);

    return NextResponse.json({
      error: false,
      message: "Successful encryption",
      data: encryptedData,
    });
  } catch (err) {
    return NextResponse.json(
      { error: true, message: "Encryption failed" },
      { status: 500 }
    );
  }
}
