const { showStatus } = require('../../../utils/show-status.js')
const { ELEMENTS } = require('../../../utils/elements.js')
const ImageFile = require('../file/ImageFile.js')
const { ipcRenderer } = require('electron')
const imageSearchAPI = require('./api.js')
const mainArea = ELEMENTS.mainArea

class AIImageSearch {
    constructor() {
        this.searchHistory = []
        this.favorites = []
        this.currentResults = []
        this.providers = ['unsplash', 'pexels', 'giphy']
        this.createSearchInterface()
    }

    createSearchInterface() {
        const container = document.createElement('div')
        container.className = 'ai-search-container'

        // Create filters
        const filtersContainer = document.createElement('div')
        filtersContainer.className = 'ai-search-filters'

        this.providers.forEach(provider => {
            const filter = document.createElement('div')
            filter.className = 'ai-search-filter'
            filter.textContent = provider.charAt(0).toUpperCase() + provider.slice(1)
            filter.dataset.provider = provider
            filter.onclick = () => this.toggleFilter(filter)
            filtersContainer.appendChild(filter)
        })

        // Create search form
        const searchForm = document.createElement('form')
        searchForm.className = 'ai-search-form'

        const input = document.createElement('input')
        input.type = 'text'
        input.placeholder = 'Describe the image you\'re looking for...'
        input.className = 'ai-search-input'

        const searchButton = document.createElement('button')
        searchButton.textContent = 'Search'
        searchButton.className = 'ai-search-button'
        searchButton.type = 'submit'

        searchForm.appendChild(input)
        searchForm.appendChild(searchButton)

        // Create results container
        const resultsGrid = document.createElement('div')
        resultsGrid.className = 'ai-search-results'

        // Create search history section
        const historyContainer = document.createElement('div')
        historyContainer.className = 'ai-search-history-container'
        historyContainer.style.display = 'none' // Hide initially

        const historyTitle = document.createElement('div')
        historyTitle.className = 'ai-search-history-title'
        historyTitle.textContent = 'Recent Searches'

        const historyItems = document.createElement('div')
        historyItems.className = 'ai-search-history-items'

        historyContainer.appendChild(historyTitle)
        historyContainer.appendChild(historyItems)

        // Assemble the interface
        container.appendChild(filtersContainer)
        container.appendChild(searchForm)
        container.appendChild(resultsGrid)
        container.appendChild(historyContainer)

        mainArea.appendChild(container)

        this.elements = {
            input,
            resultsGrid,
            historyItems,
            historyContainer,
            filtersContainer
        }

        this.setupEventListeners(searchForm)
    }

    toggleFilter(filterElement) {
        filterElement.classList.toggle('active')
    }

    getActiveFilters() {
        const activeFilters = []
        const filters = this.elements.filtersContainer.querySelectorAll('.ai-search-filter.active')
        filters.forEach(filter => activeFilters.push(filter.dataset.provider))
        return activeFilters.length > 0 ? activeFilters : this.providers // If none selected, use all
    }

    setupEventListeners(form) {
        form.onsubmit = async (e) => {
            e.preventDefault()
            const query = this.elements.input.value.trim()
            if (!query) return

            await this.handleSearch(query)
            this.addToSearchHistory(query)
        }
    }

    async handleSearch(query) {
        showStatus(`Searching for "${query}"...`)

        try {
            // Get active filters for providers
            const activeProviders = this.getActiveFilters()

            // Search across providers
            const results = await imageSearchAPI.searchAll(query, { providers: activeProviders })

            // Apply AI analysis to improve results
            const enhancedResults = imageSearchAPI.improveResults(query, results)

            this.currentResults = enhancedResults
            this.displayResults(enhancedResults)
        } catch (error) {
            console.error('Search error:', error)
            showStatus('Error searching for images', 'red')
        }
    }

    displayResults(results) {
        const container = this.elements.resultsGrid
        container.innerHTML = ''

        if (results.length === 0) {
            showStatus('No images found matching your search', 'orange')
            const noResults = document.createElement('div')
            noResults.textContent = 'No images found. Try a different search term.'
            noResults.style.padding = '2rem'
            noResults.style.textAlign = 'center'
            noResults.style.width = '100%'
            container.appendChild(noResults)
            return
        }

        results.forEach(result => {
            const imageWrapper = document.createElement('div')
            imageWrapper.className = 'ai-search-result'

            const img = new Image()
            img.src = result.thumbnail || result.url
            img.alt = result.tags?.join(', ') || 'Image result'
            img.draggable = true
            img.loading = 'lazy'

            const attribution = document.createElement('div')
            attribution.className = 'ai-search-attribution'
            attribution.textContent = result.attribution || `Source: ${result.provider}`

            imageWrapper.appendChild(img)
            imageWrapper.appendChild(attribution)
            container.appendChild(imageWrapper)

            this.setupImageEvents(img, result)
        })

        showStatus(`Found ${results.length} images`)
    }

    setupImageEvents(img, result) {
        img.ondragstart = async (event) => {
            event.preventDefault()
            try {
                const imageFile = new ImageFile(result.url)
                await imageFile.generate()
                const buffer = Buffer.from(imageFile.arrayBuffer)
                ipcRenderer.send('dragstart', { buffer, name: imageFile.name })
            } catch (error) {
                console.error('Error preparing image for drag:', error)
                showStatus('Error preparing image for drag', 'red')
            }
        }
    }

    addToSearchHistory(query) {
        // Don't add duplicates
        if (!this.searchHistory.includes(query)) {
            this.searchHistory.unshift(query)

            // Limit history size
            if (this.searchHistory.length > 10) {
                this.searchHistory.pop()
            }

            this.updateSearchHistoryDisplay()
        }
    }

    updateSearchHistoryDisplay() {
        const container = this.elements.historyItems
        container.innerHTML = ''

        if (this.searchHistory.length > 0) {
            this.elements.historyContainer.style.display = 'block'

            this.searchHistory.forEach(query => {
                const item = document.createElement('div')
                item.className = 'ai-search-history-item'
                item.textContent = query
                item.onclick = () => {
                    this.elements.input.value = query
                    this.handleSearch(query)
                }
                container.appendChild(item)
            })
        } else {
            this.elements.historyContainer.style.display = 'none'
        }
    }
}

module.exports = new AIImageSearch()