import { NextRequest, NextResponse } from "next/server";
import { checkFlag } from "@/lib/flag";

interface CheckFlagBody {
  email?: string;
  flag?: string;
  key?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: CheckFlagBody = await req.json();
    const { email, flag, key } = body;

    if (!email || !flag || !key) {
      return NextResponse.json(
        { error: true, message: "Email or Flag or Key has not been provided" },
        { status: 404 }
      );
    }

    return NextResponse.json(checkFlag(email, flag, key), { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: true, message: "Flag validation failed" },
      { status: 500 }
    );
  }
}
