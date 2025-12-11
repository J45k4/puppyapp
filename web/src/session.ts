let sessionChecked = false
let sessionAuth = false

export const markSessionStatus = (authenticated: boolean) => {
	sessionChecked = true
	sessionAuth = authenticated
}

export const resetSessionStatus = () => {
	sessionChecked = false
	sessionAuth = false
}

export const isSessionAuthenticated = () => sessionAuth

export const hasSessionBeenChecked = () => sessionChecked
