import {jest} from '@jest/globals'

const mockGetDatesByIds = jest.fn()

jest.unstable_mockModule('../src/database/reader.js', () => ({
	Reader: jest.fn().mockImplementation(() => ({
		getDatesByIds: mockGetDatesByIds
	}))
}))

const {QueryService} = await import('../src/queryService.js')

describe('QueryService - handleEventIds (ESM with src/ path)', () => {
	let service

	beforeEach(() => {
		jest.clearAllMocks()
		service = new QueryService()
	})

	test('should return "No events" message for an empty ID list', () => {
		const result = service.handleEventIds([])
		expect(result).toBe('No events matching that description')
	})

	test('should correctly format a mix of single dates and ranges', () => {
		const mockData = [
			{
				inputId: 'Kitchen',
				description: 'Cooking Class',
				startDate: '2023-11-21',
				endDate: '2023-11-21' // Single
			},
			{
				inputId: 'Garden',
				description: 'Planting',
				startDate: '2023-11-22',
				endDate: '2023-11-25' // Range
			}
		]

		mockGetDatesByIds.mockReturnValue(mockData)

		const result = service.handleEventIds(['id_1', 'id_2'])

		// Check for specific formatting output
		expect(result).toContain('Cooking Class 21st of November at Kitchen')
		expect(result).toContain('Planting on starting 22nd of November at Garden')
	})

	test('should group multiple occurrences of the same event', () => {
		const mockData = [
			{
				inputId: 'Tech Hub',
				description: 'Coding',
				startDate: '2023-12-11',
				endDate: '2023-12-11'
			},
			{
				inputId: 'Tech Hub',
				description: 'Coding',
				startDate: '2023-12-13',
				endDate: '2023-12-13'
			}
		]

		mockGetDatesByIds.mockReturnValue(mockData)

		const result = service.handleEventIds(['id_3', 'id_4'])

		// Expect: "Description Date1, Date2 at Location"
		// Note: 11th, 12th, and 13th use 'th' suffix in your logic
		expect(result).toBe('Coding 11th of December, 13th of December at Tech Hub')
	})
})
