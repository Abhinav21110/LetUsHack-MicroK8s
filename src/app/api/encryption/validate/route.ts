import { NextRequest, NextResponse } from "next/server";
import { checkIfValidEncryption } from "@/lib/encryption";

interface ValidateRequestBody {
  inputString?: string;
  encryptedData?: string;
  key?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ValidateRequestBody = await req.json();
    const { inputString, encryptedData, key } = body;

    if (!inputString || !encryptedData || !key) {
      return NextResponse.json(
        {
          error: true,
          message:
            "Input String or Encrypted Data or Key is missing in the request",
        },
        { status: 400 }
      );
    }

    if (checkIfValidEncryption(inputString, encryptedData, key)) {
      return NextResponse.json(
        {
          error: false,
          message: "Valid Encryption",
          success: true,
          data: true,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          error: false,
          message: "Invalid Encryption",
          success: false,
          data: true,
        },
        { status: 200 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: true, message: "Validation error in server" },
      { status: 500 }
    );
  }
}
