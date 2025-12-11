import { patternMatcher } from "./pattern-matcher"
import { fetchMe } from "./api"
import {
	hasSessionBeenChecked,
	isSessionAuthenticated,
	markSessionStatus,
} from "./session"

type HandlerResult = void | Promise<void>

let matcher: any

async function ensureSession(path: string): Promise<boolean> {
	if (path === "/login") return true
	if (isSessionAuthenticated()) return true
	if (hasSessionBeenChecked()) {
		return false
	}
	try {
		const me = await fetchMe()
		markSessionStatus(!!me)
		return !!me
	} catch {
		markSessionStatus(false)
		return false
	}
}

const handleRoute = async (path: string) => {
	if (!matcher) return
	const match = matcher.match(path)
	if (!match) {
		console.error("No route found for", path)
		return
	}
	const requiresAuth = path !== "/login"
	if (requiresAuth && !(await ensureSession(path))) {
		navigate("/login")
		return
	}
	await Promise.resolve(match.result as HandlerResult)
}

window.addEventListener("popstate", () => {
	void handleRoute(window.location.pathname)
})

export const routes = (routes: any) => {
	matcher = patternMatcher(routes)
	void handleRoute(window.location.pathname)
}

export const navigate = (path: string) => {
	window.history.pushState({}, "", path)
	void handleRoute(path)
}
