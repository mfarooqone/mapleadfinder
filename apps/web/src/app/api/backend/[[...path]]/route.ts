import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:3001";

async function proxyToBackend(
  request: NextRequest,
  params: { path?: string[] },
) {
  const backendBase = BACKEND_API_BASE_URL.replace(/\/$/, "");
  const backendPath = params.path?.join("/") ?? "";
  const targetUrl = new URL(
    backendPath ? `${backendBase}/${backendPath}` : `${backendBase}/`,
  );

  targetUrl.search = request.nextUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
  }

  headers.set("accept", "application/json");

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });

    const responseBody = await response.text();
    const responseHeaders = new Headers();
    const responseType =
      response.headers.get("content-type") ?? "application/json; charset=utf-8";

    responseHeaders.set("content-type", responseType);

    return new NextResponse(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      {
        message: `Could not reach the NestJS backend at ${backendBase}. Start the backend server and make sure it is listening on that address.`,
      },
      { status: 503 },
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const params = await context.params;
  return proxyToBackend(request, params);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const params = await context.params;
  return proxyToBackend(request, params);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const params = await context.params;
  return proxyToBackend(request, params);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const params = await context.params;
  return proxyToBackend(request, params);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const params = await context.params;
  return proxyToBackend(request, params);
}
