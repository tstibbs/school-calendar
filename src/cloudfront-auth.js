function handler(event) {
	var request = event.request
	var headers = request.headers

	// This placeholder will be replaced by the CDK during deployment
	var AUTH_PASSWORD = '%%AUTH_PASSWORD%%'

	if (!headers['x-auth-password'] || headers['x-auth-password'].value !== AUTH_PASSWORD) {
		return {
			statusCode: 403,
			statusDescription: 'Forbidden',
			body: {encoding: 'text', data: 'Unauthorized: Invalid Password'}
		}
	}

	return request
}
