async function fetchUsers() {
	const res = await fetch('/users');
	const data = await res.json();
	const container = document.getElementById('users');
	if (!Array.isArray(data.users)) {
		container.textContent = 'No users';
		return;
	}
	const list = document.createElement('ul');
	data.users.forEach(u => {
		const li = document.createElement('li');
		li.textContent = u;
		list.appendChild(li);
	});
	container.replaceChildren(list);
}

async function createUser(evt) {
	evt.preventDefault();
	const form = evt.target;
	const username = form.username.value.trim();
	const password = form.password.value;
	const status = document.getElementById('status');
	status.textContent = 'Creating user...';
	const res = await fetch('/users', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password })
	});
	if (res.ok) {
		status.textContent = 'Created user ' + username;
		form.reset();
		fetchUsers();
	} else {
		const err = await res.json().catch(() => ({}));
		status.textContent = err.error || 'Failed to create user';
	}
}

document.getElementById('create-user').addEventListener('submit', createUser);
fetchUsers();
