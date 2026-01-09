import { NextRequest, NextResponse } from "next/server";
import { createFlag } from "@/lib/flag";

interface CreateFlagBody {
  email?: string;
  key?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateFlagBody = await req.json();
    const { email, key } = body;

    if (!email || !key) {
      return NextResponse.json(
        { error: true, message: "Email or Key has not been provided" },
        { status: 404 }
      );
    }

    const flag = createFlag(email, key);

    return NextResponse.json(
      {
        error: false,
        message: "Successful Flag creation",
        data: flag,
        flag: flag,
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: true, message: "Flag creation failed" },
      { status: 500 }
    );
  }
}
