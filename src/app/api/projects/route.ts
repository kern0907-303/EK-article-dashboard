import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scriptUrl = searchParams.get("url");

    if (!scriptUrl) {
      return NextResponse.json({ error: "Missing Apps Script URL" }, { status: 400 });
    }

    console.log("[API GET /api/projects] Fetching from Apps Script:", scriptUrl);
    
    // Apps Script Web Apps require following redirects (302)
    const res = await fetch(scriptUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`Google Apps Script returned status ${res.status}`);
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("[API GET /api/projects] Failed to parse Apps Script response as JSON. Response text:", text);
      throw new Error("Apps Script response is not valid JSON. Ensure you deployed it correctly as a Web App.");
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("[API GET /api/projects] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, project } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "Missing Apps Script URL" }, { status: 400 });
    }

    if (!project || !project.id) {
      return NextResponse.json({ error: "Missing project data or project ID" }, { status: 400 });
    }

    console.log("[API POST /api/projects] Syncing project to Apps Script:", project.id);

    // Call the Google Apps Script Web App
    const res = await fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(project)
    });

    if (!res.ok) {
      throw new Error(`Google Apps Script returned status ${res.status}`);
    }

    const text = await res.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.warn("[API POST /api/projects] Apps Script response was not JSON:", text);
      result = { success: true };
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("[API POST /api/projects] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to save project" }, { status: 500 });
  }
}
