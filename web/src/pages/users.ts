import { ensureShell } from "../layout"
import { fetchUsers } from "../api"
import { navigate } from "../router"

export const renderUsers = async () => {
	const content = ensureShell("/user")
	content.innerHTML = `
		<section class="hero">
			<h1>Users</h1>
			<p class="lede">PuppyNet remembers every user that can sign into the network.</p>
		</section>
		<div class="card">
			<h2>Known accounts</h2>
			<p id="users-status" class="muted">Loading users...</p>
			<div id="users-list"></div>
		</div>
	`

	const statusEl = document.getElementById("users-status")
	const listEl = document.getElementById("users-list")

	try {
		const users = await fetchUsers()
		if (statusEl) statusEl.textContent = `${users.length} user(s)`
		if (!listEl) return
		if (users.length === 0) {
			listEl.innerHTML = `<p class="muted">No users registered yet.</p>`
			return
		}
		const rows = users
			.map((name) => `<li><button class="link-btn" data-user="${name}">${name}</button></li>`)
			.join("")
		listEl.innerHTML = `<ul class="users-list">${rows}</ul>`
		const buttons = listEl.querySelectorAll<HTMLButtonElement>("[data-user]")
		buttons.forEach((btn) => {
			btn.addEventListener("click", () => {
				const username = btn.getAttribute("data-user")
				if (username) navigate(`/user/${encodeURIComponent(username)}`)
			})
		})
	} catch (err) {
		if (statusEl) statusEl.textContent = `Failed to load users: ${err}`
	}
}

export const renderUserDetail = (userId: string) => {
	const content = ensureShell("/user")
	content.innerHTML = `
		<section class="hero">
			<h1>User</h1>
			<p class="lede">Profile for <strong>${userId}</strong></p>
		</section>
		<div class="card">
			<h2>Details</h2>
			<p class="muted">Username: ${userId}</p>
			<button class="link-btn" id="back-to-users">Back to users</button>
		</div>
	`
	const back = document.getElementById("back-to-users")
	back?.addEventListener("click", () => navigate("/user"))
}
