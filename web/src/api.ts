export type Peer = {
	id: string
	name?: string | null
}

export type SearchArgs = {
	name_query?: string
	mime_types?: string[]
	page?: number
	page_size?: number
}

export type SearchResult = {
	hash: number[] | string
	name: string
	path: string
	size: number
	mime_type?: string | null
	replicas: number
	first_datetime?: string | null
	latest_datetime?: string | null
}

const envAddr = process.env.PUBLIC_SERVER_ADDR
const serverAddr = envAddr && envAddr.trim().length > 0
	? envAddr
	: (typeof window !== "undefined" ? window.location.origin : "/")

const apiBase = serverAddr.endsWith("/") ? serverAddr.slice(0, -1) : serverAddr

let peersCache: Peer[] | null = null
let bearerToken: string | null = null

export const getServerAddr = () => serverAddr

export const setBearerToken = (token: string | null) => {
	bearerToken = token
}

const authHeaders = (): HeadersInit | undefined => {
	if (!bearerToken) return undefined
	return { Authorization: `Bearer ${bearerToken}` }
}

export const apiGet = async <T>(path: string): Promise<T> => {
	const headers = authHeaders()
	const res = await fetch(`${apiBase}${path}`, {
		credentials: "include",
		headers,
	})
	if (res.status === 401) {
		throw new Error("not authenticated")
	}
	if (!res.ok) {
		throw new Error(`Request failed: ${res.status}`)
	}
	return res.json() as Promise<T>
}

export const fetchPeers = async (): Promise<Peer[]> => {
	if (!peersCache) {
		const data = await apiGet<{ peers: Peer[] }>("/api/peers")
		peersCache = data.peers
	}
	return peersCache ?? []
}

export const findPeer = async (peerId: string): Promise<Peer | undefined> => {
	const peers = await fetchPeers()
	return peers.find((p) => p.id === peerId)
}

export const clearPeerCache = () => {
	peersCache = null
}

export const fetchMimeTypes = async (): Promise<string[]> => {
	const data = await apiGet<{ mime_types: string[] }>("/api/mime-types")
	return data.mime_types
}

export const fetchUsers = async (): Promise<string[]> => {
	const data = await apiGet<{ users: string[] }>("/users")
	return data.users ?? []
}

export const searchFiles = async (
	args: SearchArgs,
): Promise<{ results: SearchResult[]; total: number; mime_types: string[] }> => {
	const params = new URLSearchParams()
	if (args.name_query) params.set("name_query", args.name_query)
	if (args.mime_types && args.mime_types.length > 0) {
		params.set("mime_types", args.mime_types.join(","))
	}
	if (args.page !== undefined) params.set("page", String(args.page))
	if (args.page_size !== undefined) params.set("page_size", String(args.page_size))
	const headers = authHeaders()
	const res = await fetch(`${apiBase}/api/search?${params.toString()}`, {
		credentials: "include",
		headers,
	})
	if (res.status === 401) {
		throw new Error("not authenticated")
	}
	if (!res.ok) {
		throw new Error(`Search failed: ${res.status}`)
	}
	const data = await res.json()
	return {
		results: data.results ?? [],
		total: data.total ?? 0,
		mime_types: data.mime_types ?? [],
	}
}

export const login = async (
	username: string,
	password: string,
	setCookie: boolean,
): Promise<{ access_token: string }> => {
	const res = await fetch(`${apiBase}/auth/login`, {
		method: "POST",
		credentials: "include",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			username,
			password,
			set_cookie: setCookie,
		}),
	})
	if (res.status === 401) {
		const message = await extractErrorMessage(res)
		throw new Error(message ?? "invalid credentials")
	}
	if (!res.ok) {
		const message = await extractErrorMessage(res)
		throw new Error(message ?? `Login failed: ${res.status}`)
	}
	return res.json()
}

async function extractErrorMessage(res: Response): Promise<string | null> {
	try {
		const data = await res.json()
		if (data && typeof data.error === "string" && data.error.length > 0) {
			return data.error
		}
	} catch {
		// ignore
	}
	return res.statusText
}

export const fetchMe = async (): Promise<string | null> => {
	const headers = authHeaders()
	const res = await fetch(`${apiBase}/auth/me`, {
		credentials: "include",
		headers,
	})
	if (res.status === 401) {
		return null
	}
	if (!res.ok) {
		throw new Error(`Failed to load session: ${res.status}`)
	}
	const data = await res.json()
	return data.user ?? null
}

export const logout = async (): Promise<void> => {
	await fetch(`${apiBase}/auth/logout`, {
		method: "POST",
		credentials: "include",
	})
	setBearerToken(null)
	peersCache = null
}
