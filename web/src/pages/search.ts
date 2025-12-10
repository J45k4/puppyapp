import { ensureShell } from "../layout"
import { fetchFileChunk, fetchMimeTypes, fetchThumbnail, fetchWholeFile, searchFiles, type SearchResult } from "../api"
import { createMultiSelect } from "../multiselect"

const defaultPageSize = 25

export const renderSearch = async () => {
	const content = ensureShell("/search")
	content.innerHTML = `
		<section class="hero">
			<h1>Search</h1>
			<p class="lede">Search across indexed files.</p>
		</section>
		<div class="card">
			<h2>Filters</h2>
			<form id="search-form">
				<input id="search-name" name="name_query" placeholder="Name contains..." />
				<div id="search-mime"></div>
				<button type="submit">Search</button>
			</form>
			<p id="search-status" class="muted">Enter a query to search.</p>
		</div>
		<div class="card" id="search-results">
			<h2>Results</h2>
			<div id="search-table"></div>
		</div>
		<div class="card" id="search-preview-card">
			<h2>Preview</h2>
			<div id="search-preview" class="muted">Select a file to preview (images and text supported).</div>
		</div>
	`

	const statusEl = document.getElementById("search-status")
	const tableEl = document.getElementById("search-table")
	const nameInput = document.getElementById("search-name") as HTMLInputElement | null
	const mimeMount = document.getElementById("search-mime")
	const mimeSelect = createMultiSelect({
		id: "search-mime-select",
		placeholder: "Mime types",
	})
	if (mimeMount?.parentElement) {
		mimeMount.parentElement.replaceChild(mimeSelect.element, mimeMount)
	}

	let currentPage = 0
	let totalResults = 0
	let loading = false
	let hasMore = false
	let observer: IntersectionObserver | null = null
	let currentResults: SearchResult[] = []
	let modal: HTMLElement | null = null

	const ensureModal = () => {
		if (modal) return modal
		modal = document.createElement("div")
		modal.className = "modal hidden"
		modal.innerHTML = `
			<div class="modal-backdrop"></div>
			<div class="modal-dialog">
				<button class="modal-close" aria-label="Close">×</button>
				<div class="modal-body"></div>
			</div>
		`
		document.body.appendChild(modal)
		const closeBtn = modal.querySelector(".modal-close")
		const backdrop = modal.querySelector(".modal-backdrop")
		const close = () => modal?.classList.add("hidden")
		closeBtn?.addEventListener("click", close)
		backdrop?.addEventListener("click", close)
		return modal
	}

	const openModal = (html: string) => {
		const m = ensureModal()
		const body = m.querySelector(".modal-body")
		if (body) {
			body.innerHTML = html
		}
		m.classList.remove("hidden")
	}

	const loadMimeTypes = async () => {
		try {
			const mimes = await fetchMimeTypes()
			mimeSelect.setOptions(
				mimes.map((m) => ({
					value: m,
					label: m,
				})),
			)
		} catch (err) {
			if (statusEl) statusEl.textContent = `Failed to load mime types: ${err}`
		}
	}

	const resetTable = () => {
		if (!tableEl) return
		tableEl.innerHTML = `
			<div class="table-wrapper">
				<table class="table">
					<thead>
						<tr>
							<th>Name</th>
							<th>Type</th>
						<th>Size</th>
						<th>Replicas</th>
						<th>Updated</th>
					</tr>
				</thead>
					<tbody id="search-body"></tbody>
				</table>
			</div>
			<div id="search-sentinel"></div>
		`
	}

	const appendRows = (rows: any[]) => {
		const body = document.getElementById("search-body")
		if (!body) return
		const startIndex = currentResults.length
		currentResults.push(...(rows as SearchResult[]))
		const html = rows
			.map(
				(r, idx) => `
					<tr data-idx="${startIndex + idx}">
						<td>${r.name}</td>
						<td class="muted">${r.mime_type ?? "unknown"}</td>
						<td>${((r.size ?? 0) / 1024).toFixed(1)} KB</td>
						<td><span class="badge small">${r.replicas} replicas</span></td>
						<td class="muted">${r.latest_datetime ?? ""}</td>
					</tr>
				`,
			)
			.join("")
		body.insertAdjacentHTML("beforeend", html)
	}

	const loadPage = async () => {
		if (loading) return
		loading = true
		if (statusEl) statusEl.textContent = "Searching..."
		try {
			const name_query = nameInput?.value.trim() ?? ""
			const mime_types = mimeSelect.getSelected()
			const data = await searchFiles({
				name_query: name_query || undefined,
				mime_types: mime_types.length ? mime_types : undefined,
				page: currentPage,
				page_size: defaultPageSize,
			})
			totalResults = data.total ?? 0
			if (!tableEl) return
			if (currentPage === 0) {
				resetTable()
			}
			if (!data.results.length && currentPage === 0) {
				tableEl.innerHTML = `<p class="muted">No results.</p>`
				hasMore = false
				return
			}
			appendRows(data.results as any[])
			currentPage += 1
			const loadedCount = Math.min(currentPage * defaultPageSize, totalResults)
			if (statusEl) statusEl.textContent = `Loaded ${loadedCount} of ${totalResults} result(s)`
			hasMore = loadedCount < totalResults
			const sentinel = document.getElementById("search-sentinel")
			if (sentinel) {
				if (!observer) {
					observer = new IntersectionObserver((entries) => {
						if (entries.some((e) => e.isIntersecting) && hasMore) {
							void loadPage()
						}
					})
				}
				if (hasMore) observer.observe(sentinel)
				else observer.unobserve(sentinel)
			}
		} catch (err) {
			if (statusEl) statusEl.textContent = `Search failed: ${err}`
		} finally {
			loading = false
		}
	}

	const form = document.getElementById("search-form")
	form?.addEventListener("submit", (ev) => {
		ev.preventDefault()
		currentPage = 0
		totalResults = 0
		hasMore = false
		if (observer) {
			const sentinel = document.getElementById("search-sentinel")
			if (sentinel) observer.unobserve(sentinel)
		}
		currentResults = []
		resetTable()
		void loadPage()
	})

	const decodeText = (data: number[]) => {
		try {
			return new TextDecoder().decode(new Uint8Array(data))
		} catch (err) {
			return `Failed to decode text: ${err}`
		}
	}

	const renderPreview = async (item: SearchResult) => {
		const mount = document.getElementById("search-preview")
		if (!mount) return
		mount.textContent = "Loading preview..."
		if (!item.peer_id) {
			mount.textContent = "No peer information available for this file."
			return
		}
		try {
			if (item.mime_type && item.mime_type.startsWith("image/")) {
				const blob = await fetchThumbnail(item.peer_id, item.path, 768, 768)
				const url = URL.createObjectURL(blob)
				const modalHtml = `
					<div class="preview-heading">
						<div>
							<p class="muted">${item.name}</p>
							<p class="muted">${item.mime_type}</p>
						</div>
						<button class="button button-ghost" id="modal-download">Download</button>
					</div>
					<div class="preview-image"><img src="${url}" alt="${item.name}" /></div>
				`
				openModal(modalHtml)
				const downloadBtn = document.getElementById("modal-download")
				downloadBtn?.addEventListener("click", async () => {
					downloadBtn.setAttribute("disabled", "true")
					downloadBtn.textContent = "Downloading..."
					await downloadFile(item)
					downloadBtn.textContent = "Download"
					downloadBtn.removeAttribute("disabled")
				})
				mount.textContent = "Image preview opened."
			} else if (item.mime_type && (item.mime_type.startsWith("text/") || item.mime_type.includes("json"))) {
				const chunk = await fetchFileChunk(item.peer_id, item.path, 0, 65536)
				const text = decodeText(chunk.data)
				const modalHtml = `
					<div class="preview-heading">
						<div>
							<p class="muted">${item.name}</p>
							<p class="muted">${item.mime_type ?? "text"}</p>
						</div>
						<button class="button button-ghost" id="modal-download">Download</button>
					</div>
					<pre class="preview-text">${text
						.replace(/</g, "&lt;")
						.replace(/>/g, "&gt;")
						.slice(0, 8000)}</pre>
				`
				openModal(modalHtml)
				const downloadBtn = document.getElementById("modal-download")
				downloadBtn?.addEventListener("click", async () => {
					downloadBtn.setAttribute("disabled", "true")
					downloadBtn.textContent = "Downloading..."
					await downloadFile(item)
					downloadBtn.textContent = "Download"
					downloadBtn.removeAttribute("disabled")
				})
				mount.textContent = "Text preview opened."
			} else {
				mount.textContent = "Preview not available for this file type."
			}
		} catch (err) {
			mount.textContent = `Preview failed: ${err}`
		}
	}

	const downloadFile = async (item: SearchResult) => {
		if (!item.peer_id) {
			alert("No peer information for this file.")
			return
		}
		const data = await fetchWholeFile(item.peer_id, item.path)
		const blob = new Blob([data], { type: item.mime_type ?? "application/octet-stream" })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = item.name || "download"
		document.body.appendChild(a)
		a.click()
		a.remove()
		URL.revokeObjectURL(url)
	}

	tableEl?.addEventListener("click", (ev) => {
		const row = (ev.target as HTMLElement).closest("tr[data-idx]") as HTMLTableRowElement | null
		if (!row) return
		const idx = Number(row.dataset.idx)
		const item = currentResults[idx]
		if (item) {
			void renderPreview(item)
		}
	})

	void loadMimeTypes()
}
