function handler(event) {
	var request = event.request
	var headers = request.headers

	// This placeholder will be replaced by CDK during deployment
	var AUTH_PASSWORD = '%%AUTH_PASSWORD%%'

	if (!headers['x-auth-password'] || headers['x-auth-password'].value !== AUTH_PASSWORD) {
		return {
			statusCode: 403,
			statusDescription: 'Forbidden',
			body: {encoding: 'text', data: 'Unauthorized: Invalid Password'}
		}
	}
	if (request.method != 'PUT') {
		return {
			statusCode: 403,
			statusDescription: 'Forbidden',
			body: {encoding: 'text', data: 'Unauthorized: Disallowed method'}
		}
	}
	if (!/^\/[\w-_]+\/input\.pdf$/.test(request.uri)) {
		return {
			statusCode: 403,
			statusDescription: 'Forbidden',
			body: {encoding: 'text', data: 'Unauthorized: Invalid file path'}
		}
	}
	return request
}
