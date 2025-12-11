import { ensureLoginShell } from "../layout"
import { login } from "../api"
import { navigate } from "../router"
import { markSessionStatus } from "../session"

const statusMsg = (el: HTMLElement | null, msg: string) => {
	if (el) el.textContent = msg
}

export const renderLogin = async () => {
	const content = ensureLoginShell()
	content.innerHTML = `
		<section class="hero">
			<h1>Sign in to PuppyNet</h1>
			<p class="lede">Log in with your PuppyNet credentials to continue.</p>
		</section>
		<div class="card login-card">
			<form id="login-form">
				<input id="login-username" name="username" placeholder="Username" autocomplete="username" required />
				<input id="login-password" name="password" type="password" placeholder="Password" autocomplete="current-password" required />
				<button type="submit">Sign in</button>
			</form>
			<p id="login-status" class="login-status"></p>
		</div>
	`

	const form = document.getElementById("login-form")
	const usernameInput = document.getElementById("login-username") as HTMLInputElement | null
	const passwordInput = document.getElementById("login-password") as HTMLInputElement | null
	const statusEl = document.getElementById("login-status")

		form?.addEventListener("submit", async (ev) => {
		ev.preventDefault()
		const username = usernameInput?.value.trim() ?? ""
		const password = passwordInput?.value ?? ""
		if (!username || !password) {
			statusMsg(statusEl, "Please enter username and password.")
			return
		}
		statusMsg(statusEl, "Signing in...")
		try {
			await login(username, password, true)
			markSessionStatus(true)
			navigate("/")
		} catch (err) {
			if (err instanceof Error) {
				statusMsg(statusEl, err.message)
			} else {
				statusMsg(statusEl, `Login failed: ${String(err)}`)
			}
		}
	})
}
