class YouTubeSearchTool {
    constructor() {
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
        this.searchResults = [];
        
        // API Keys management
        this.apiKeys = [];
        this.currentApiKeyIndex = 0;
        this.keyValidationStatus = {};
        
        // Comment pagination variables
        this.currentVideoId = null;
        this.nextPageToken = null;
        this.isLoadingComments = false;
        this.hasMoreComments = true;
        this.targetCommentCount = 50;
        this.currentCommentCount = 0;
        
        this.initializeEventListeners();
        this.loadSavedApiKeys();
    }
    
    getCurrentApiKey() {
        if (this.apiKeys.length === 0) return null;
        return this.apiKeys[this.currentApiKeyIndex];
    }
    
    switchToNextApiKey() {
        if (this.apiKeys.length <= 1) return false;
        
        this.currentApiKeyIndex = (this.currentApiKeyIndex + 1) % this.apiKeys.length;
        console.log(`Switched to API key index: ${this.currentApiKeyIndex}`);
        this.updateCurrentKeyDisplay();
        return true;
    }
    
    loadSavedApiKeys() {
        try {
            const savedKeys = localStorage.getItem('youtube_api_keys');
            if (savedKeys) {
                this.apiKeys = JSON.parse(savedKeys);
                this.updateApiKeyTextarea();
                this.updateApiKeyCount();
                this.updateCurrentKeyDisplay();
                
                // Validate saved keys
                if (this.apiKeys.length > 0) {
                    this.validateAllApiKeys();
                }
            }
        } catch (error) {
            console.error('Error loading saved API keys:', error);
            this.apiKeys = [];
        }
    }
    
    saveApiKeys() {
        try {
            localStorage.setItem('youtube_api_keys', JSON.stringify(this.apiKeys));
        } catch (error) {
            console.error('Error saving API keys:', error);
        }
    }
    
    parseApiKeysFromTextarea() {
        const textarea = document.getElementById('apiKeyInput');
        const text = textarea.value.trim();
        
        if (!text) return [];
        
        const keys = text.split('\n')
            .map(key => key.trim())
            .filter(key => key.length > 0)
            .filter((key, index, array) => array.indexOf(key) === index); // Remove duplicates
        
        return keys;
    }
    
    updateApiKeyTextarea() {
        const textarea = document.getElementById('apiKeyInput');
        textarea.value = this.apiKeys.join('\n');
    }
    
    updateApiKeyCount() {
        const countElement = document.querySelector('.api-key-count');
        if (countElement) {
            countElement.textContent = `${this.apiKeys.length} API key${this.apiKeys.length !== 1 ? 's' : ''}`;
        }
    }
    
    updateCurrentKeyDisplay() {
        const currentKeyElement = document.getElementById('currentKeyIndex');
        if (currentKeyElement) {
            if (this.apiKeys.length > 0) {
                const currentKey = this.getCurrentApiKey();
                const preview = currentKey ? `${currentKey.substring(0, 15)}...` : 'None';
                currentKeyElement.textContent = `#${this.currentApiKeyIndex + 1} (${preview})`;
            } else {
                currentKeyElement.textContent = 'Chưa có';
            }
        }
    }
    
    translateErrorMessage(errorMessage) {
        const translations = {
            'API key not valid': 'API key không hợp lệ',
            'API key is missing': 'Thiếu API key',
            'quota': 'Đã hết quota hằng ngày',
            'quotaExceeded': 'Đã vượt quota',
            'rateLimitExceeded': 'Vượt giới hạn tần suất',
            'invalidParameter': 'Tham số không hợp lệ',
            'forbidden': 'Bị cấm truy cập',
            'keyExpired': 'API key đã hết hạn',
            'keyInvalid': 'API key không đúng định dạng',
            'Daily Limit Exceeded': 'Đã vượt giới hạn hằng ngày',
            'The request cannot be completed because you have exceeded your quota': 'Không thể hoàn thành yêu cầu vì bạn đã vượt quota',
            'YouTube Data API v3 has not been used in project': 'YouTube Data API v3 chưa được bật trong project',
            'API key is not valid': 'API key không hợp lệ hoặc bị hạn chế',
            'Network error': 'Lỗi kết nối mạng',
            'Bad Request': 'Yêu cầu không hợp lệ',
            'Unauthorized': 'Không được phép truy cập',
            'Forbidden': 'Bị cấm truy cập - kiểm tra API key',
            'Not Found': 'Không tìm thấy endpoint',
            'Internal Server Error': 'Lỗi máy chủ nội bộ'
        };

        // Tìm từ khóa trong error message
        for (const [key, value] of Object.entries(translations)) {
            if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
                return value;
            }
        }

        return errorMessage; // Trả về original nếu không tìm thấy translation
    }

    async validateSingleApiKey(apiKey) {
        try {
            const response = await fetch(`${this.baseUrl}/search?part=snippet&q=test&maxResults=1&key=${apiKey}`);
            const data = await response.json();
            
            if (data.error) {
                const translatedError = this.translateErrorMessage(data.error.message);
                return { valid: false, error: translatedError };
            } else {
                return { valid: true, error: null };
            }
        } catch (error) {
            const translatedError = this.translateErrorMessage(error.message || 'Lỗi kết nối');
            return { valid: false, error: translatedError };
        }
    }
    
    async validateAllApiKeys() {
        const statusList = document.getElementById('apiStatusList');
        statusList.innerHTML = '';
        
        if (this.apiKeys.length === 0) {
            statusList.innerHTML = '<p class="no-keys">Chưa có API key nào</p>';
            return;
        }
        
        // Show checking status
        this.apiKeys.forEach((key, index) => {
            const keyItem = this.createApiKeyStatusItem(key, index, 'checking', 'Đang kiểm tra...');
            statusList.appendChild(keyItem);
        });
        
        // Validate each key
        for (let i = 0; i < this.apiKeys.length; i++) {
            const key = this.apiKeys[i];
            const result = await this.validateSingleApiKey(key);
            
            this.keyValidationStatus[key] = result;
            
            // Update UI
            const keyItem = statusList.children[i];
            if (result.valid) {
                keyItem.className = `api-key-item valid ${i === this.currentApiKeyIndex ? 'current' : ''}`;
                keyItem.querySelector('.key-status').textContent = '✅ Hợp lệ';
            } else {
                keyItem.className = `api-key-item invalid ${i === this.currentApiKeyIndex ? 'current' : ''}`;
                keyItem.querySelector('.key-status').textContent = `❌ ${result.error}`;
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    
    createApiKeyStatusItem(key, index, status, statusText) {
        const item = document.createElement('div');
        item.className = `api-key-item ${status} ${index === this.currentApiKeyIndex ? 'current' : ''}`;
        
        const preview = key.substring(0, 15) + '...';
        
        item.innerHTML = `
            <div class="key-preview">#${index + 1}: ${preview}</div>
            <div style="display: flex; align-items: center; gap: 5px;">
                <span class="key-status">${statusText}</span>
                <button class="key-remove" onclick="removeApiKey(${index})" title="Xóa key này">🗑️</button>
            </div>
        `;
        
        return item;
    }
    
    removeApiKeyAt(index) {
        if (index >= 0 && index < this.apiKeys.length) {
            const removedKey = this.apiKeys[index];
            this.apiKeys.splice(index, 1);
            
            // Delete validation status
            delete this.keyValidationStatus[removedKey];
            
            // Adjust current index if necessary
            if (this.currentApiKeyIndex >= index && this.currentApiKeyIndex > 0) {
                this.currentApiKeyIndex--;
            } else if (this.currentApiKeyIndex >= this.apiKeys.length && this.apiKeys.length > 0) {
                this.currentApiKeyIndex = 0;
            }
            
            this.saveApiKeys();
            this.updateApiKeyTextarea();
            this.updateApiKeyCount();
            this.updateCurrentKeyDisplay();
            this.validateAllApiKeys();
        }
    }
    
    addApiKeysFromTextarea() {
        const newKeys = this.parseApiKeysFromTextarea();
        
        if (newKeys.length === 0) {
            alert('Vui lòng nhập ít nhất một API key!');
            return;
        }
        
        // Add only new keys
        const addedKeys = [];
        newKeys.forEach(key => {
            if (!this.apiKeys.includes(key)) {
                this.apiKeys.push(key);
                addedKeys.push(key);
            }
        });
        
        if (addedKeys.length === 0) {
            alert('Tất cả API key đã tồn tại!');
            return;
        }
        
        this.saveApiKeys();
        this.updateApiKeyTextarea();
        this.updateApiKeyCount();
        this.updateCurrentKeyDisplay();
        this.validateAllApiKeys();
        
        showNotification(`Đã thêm ${addedKeys.length} API key mới!`, 3000);
    }
    
    clearAllApiKeys() {
        if (this.apiKeys.length === 0) {
            alert('Không có API key nào để xóa!');
            return;
        }
        
        if (confirm(`Bạn có chắc muốn xóa tất cả ${this.apiKeys.length} API key?`)) {
            this.apiKeys = [];
            this.currentApiKeyIndex = 0;
            this.keyValidationStatus = {};
            
            this.saveApiKeys();
            this.updateApiKeyTextarea();
            this.updateApiKeyCount();
            this.updateCurrentKeyDisplay();
            
            const statusList = document.getElementById('apiStatusList');
            statusList.innerHTML = '<p class="no-keys">Chưa có API key nào</p>';
            
            showNotification('Đã xóa tất cả API key!', 2000);
        }
    }
    
    initializeEventListeners() {
        document.getElementById('searchBtn').addEventListener('click', () => this.searchVideos());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadResults());
        document.getElementById('copyColumn8Btn').addEventListener('click', () => this.copyColumn8());
        document.getElementById('copySelectedBtn').addEventListener('click', () => this.copySelectedRows());
        document.getElementById('applyBtn').addEventListener('click', () => this.applyCustomValues());
        
        // API Key management events
        document.getElementById('validateAllKeys').addEventListener('click', () => this.validateAllApiKeys());
        document.getElementById('addMoreKeys').addEventListener('click', () => this.addApiKeysFromTextarea());
        document.getElementById('clearAllKeys').addEventListener('click', () => this.clearAllApiKeys());
        
        // Select all checkbox trong header
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                this.toggleAllRows(e.target.checked);
            });
        }
        
        // Column checkbox events
        ['includeKeyword', 'includeTitle', 'includeVideoId', 'includeVideoUrl', 'includeChannelName', 'includeChannelUrl', 'includeDuration'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    this.updateResultsIfAvailable();
                });
            }
        });
        
        // Format checkbox events
        const addChannelName = document.getElementById('addChannelName');
        const addVideoTitle = document.getElementById('addVideoTitle');
        
        if (addChannelName) {
            addChannelName.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.updateTickOrder('channelName');
                } else {
                    this.removeFromTickOrder('channelName');
                }
                this.updateResultsIfAvailable();
            });
        }
        
        if (addVideoTitle) {
            addVideoTitle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.updateTickOrder('videoTitle');
                } else {
                    this.removeFromTickOrder('videoTitle');
                }
                this.updateResultsIfAvailable();
            });
        }
    }
    
    // Thêm method validateCurrentApiKey bị thiếu
    async validateCurrentApiKey() {
        const currentKey = this.getCurrentApiKey();
        if (!currentKey) {
            return false;
        }

        try {
            const response = await fetch(`${this.baseUrl}/search?part=snippet&q=test&maxResults=1&key=${currentKey}`);
            const data = await response.json();
            
            if (data.error) {
                return false;
            } else {
                return true;
            }
        } catch (error) {
            return false;
        }
    }

    // Sửa lại method searchVideos
    async searchVideos() {
        // Kiểm tra API key trước khi tìm kiếm
        if (this.apiKeys.length === 0) {
            alert('Vui lòng thêm ít nhất một YouTube API Key trước khi tìm kiếm!');
            return;
        }

        const keywordInput = document.getElementById('searchKeyword').value.trim();
        const videoCount = parseInt(document.getElementById('videoCount').value);
        
        if (!keywordInput) {
            alert('Vui lòng nhập từ khóa tìm kiếm!');
            return;
        }
        
        // Tách từ khóa bằng cả xuống dòng VÀ dấu phẩy
        const keywords = this.parseKeywords(keywordInput);
        
        if (keywords.length === 0) {
            alert('Vui lòng nhập ít nhất một từ khóa hợp lệ!');
            return;
        }
        
        this.showLoading();
        this.hideError();
        
        // Xóa kết quả cũ
        this.searchResults = [];
        
        try {
            const filters = this.getSearchFilters();
            
            // Hiển thị số lượng từ khóa sẽ tìm
            console.log(`Bắt đầu tìm kiếm với ${keywords.length} từ khóa:`, keywords);
            
            // Tìm kiếm cho từng từ khóa
            for (const keyword of keywords) {
                await this.searchSingleKeyword(keyword, videoCount, filters);
                
                // Thêm delay nhỏ giữa các request để tránh rate limit
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            if (this.searchResults.length > 0) {
                this.displayResults();
                document.getElementById('downloadBtn').disabled = false;
                document.getElementById('copyColumn8Btn').disabled = false;
                document.getElementById('copySelectedBtn').disabled = false;
                document.getElementById('applyBtn').disabled = false;
            } else {
                this.showError('Không tìm thấy video nào với các từ khóa này.');
            }
            
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Có lỗi xảy ra khi tìm kiếm: ' + this.translateErrorMessage(error.message));
        }
        
        this.hideLoading();
    }

    // Sửa lại method searchSingleKeyword
    async searchSingleKeyword(keyword, videoCount, filters) {
        const searchParams = {
            part: 'snippet',
            q: keyword,
            type: 'video',
            maxResults: Math.min(videoCount, 50),
            key: this.getCurrentApiKey(),
            regionCode: 'US', // Lấy kết quả từ khu vực Mỹ
            relevanceLanguage: 'en', // Ưu tiên nội dung tiếng Anh
            hl: 'en', // Sử dụng hl=en để tìm kiếm, xử lý ngôn ngữ trong getVideoDetails
            ...filters
        };
        
        let retryCount = 0;
        const maxRetries = this.apiKeys.length;
        
        while (retryCount < maxRetries) {
            try {
                const response = await fetch(`${this.baseUrl}/search?${new URLSearchParams(searchParams)}`);
                const data = await response.json();
                
                if (data.error) {
                    if (data.error.message.includes('quota') && this.switchToNextApiKey()) {
                        console.log('API key quota exceeded, switching to next key...');
                        searchParams.key = this.getCurrentApiKey();
                        retryCount++;
                        continue; // Thử lại với key mới
                    } else {
                        throw new Error(this.translateErrorMessage(data.error.message));
                    }
                } else {
                    if (data.items && data.items.length > 0) {
                        await this.getVideoDetails(data.items, keyword);
                    }
                    break; // Thành công, thoát loop
                }
            } catch (error) {
                if (retryCount === maxRetries - 1) {
                    throw error; // Đã thử hết key, throw error
                }
                retryCount++;
            }
        }
    }

    // Thêm method translateErrorMessage nếu chưa có
    translateErrorMessage(errorMessage) {
        const translations = {
            'API key not valid': 'API key không hợp lệ',
            'API key is missing': 'Thiếu API key',
            'quota': 'Đã hết quota hằng ngày',
            'quotaExceeded': 'Đã vượt quota',
            'rateLimitExceeded': 'Vượt giới hạn tần suất',
            'invalidParameter': 'Tham số không hợp lệ',
            'forbidden': 'Bị cấm truy cập',
            'keyExpired': 'API key đã hết hạn',
            'keyInvalid': 'API key không đúng định dạng',
            'Daily Limit Exceeded': 'Đã vượt giới hạn hằng ngày',
            'The request cannot be completed because you have exceeded your quota': 'Không thể hoàn thành yêu cầu vì bạn đã vượt quota',
            'YouTube Data API v3 has not been used in project': 'YouTube Data API v3 chưa được bật trong project',
            'API key is not valid': 'API key không hợp lệ hoặc bị hạn chế',
            'Network error': 'Lỗi kết nối mạng',
            'Bad Request': 'Yêu cầu không hợp lệ',
            'Unauthorized': 'Không được phép truy cập',
            'Forbidden': 'Bị cấm truy cập - kiểm tra API key',
            'Not Found': 'Không tìm thấy endpoint',
            'Internal Server Error': 'Lỗi máy chủ nội bộ'
        };

        // Tìm từ khóa trong error message
        for (const [key, value] of Object.entries(translations)) {
            if (errorMessage && errorMessage.toLowerCase().includes(key.toLowerCase())) {
                return value;
            }
        }

        return errorMessage || 'Lỗi không xác định'; // Trả về original nếu không tìm thấy translation
    }

    // Đảm bảo method parseKeywords tồn tại
    parseKeywords(input) {
        // Bước 1: Tách theo xuống dòng trước
        const linesByNewline = input.split('\n');
        
        // Bước 2: Với mỗi dòng, tách tiếp theo dấu phẩy
        const allKeywords = [];
        
        linesByNewline.forEach(line => {
            // Tách theo dấu phẩy trong mỗi dòng
            const keywordsInLine = line.split(',');
            keywordsInLine.forEach(keyword => {
                const trimmedKeyword = keyword.trim();
                if (trimmedKeyword.length > 0) {
                    allKeywords.push(trimmedKeyword);
                }
            });
        });
        
        // Loại bỏ từ khóa trùng lặp (nếu có)
        const uniqueKeywords = [...new Set(allKeywords)];
        
        console.log('Parsed keywords:', uniqueKeywords);
        return uniqueKeywords;
    }

    // Đảm bảo method getSearchFilters tồn tại
    getSearchFilters() {
        const filters = {};
        
        // Bộ lọc ngày tải lên - sử dụng publishedAfter
        const uploadDate = document.getElementById('uploadDate')?.value;
        if (uploadDate) {
            const now = new Date();
            let publishedAfter;
            
            switch (uploadDate) {
                case 'hour':
                    publishedAfter = new Date(now.getTime() - 60 * 60 * 1000);
                    break;
                case 'today':
                    publishedAfter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    publishedAfter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    publishedAfter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case 'year':
                    publishedAfter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                    break;
            }
            
            if (publishedAfter) {
                filters.publishedAfter = publishedAfter.toISOString();
            }
        }
        
        // Bộ lọc loại - chỉ hỗ trợ video, channel, playlist
        const type = document.getElementById('type')?.value;
        if (type) {
            filters.type = type;
        }
        
        // Bộ lọc thời lượng - sử dụng videoDuration
        const duration = document.getElementById('duration')?.value;
        if (duration) {
            filters.videoDuration = duration;
        }
        
        // Bộ lọc tính năng
        const features = document.getElementById('features')?.value;
        if (features) {
            switch (features) {
                case 'live':
                    filters.eventType = 'live';
                    break;
                case '4k':
                case 'hd':
                    filters.videoDefinition = 'high';
                    break;
                case 'cc':
                    filters.videoCaption = 'closedCaption';
                    break;
                case 'creativeCommons':
                    filters.videoLicense = 'creativeCommon';
                    break;
                case '360':
                    filters.videoDimension = '3d';
                    break;
                case 'hdr':
                    filters.videoDefinition = 'high';
                    break;
            }
        }
        
        // Bộ lọc sắp xếp - sử dụng order
        const sortBy = document.getElementById('sortBy')?.value;
        if (sortBy) {
            const sortMap = {
                'relevance': 'relevance',
                'date': 'date',
                'viewCount': 'viewCount',
                'rating': 'rating'
            };
            filters.order = sortMap[sortBy];
        }
        
        return filters;
    }
    
    async getVideoDetails(videoItems, keyword) {
        try {
            const videoIds = videoItems.map(item => item.id.videoId).join(',');
            
            // Lấy thông tin video với localized để kiểm tra xem có tiêu đề tiếng Anh không
            const response = await fetch(`${this.baseUrl}/videos?part=snippet,contentDetails,liveStreamingDetails,statistics,localizations&id=${videoIds}&hl=en&key=${this.getCurrentApiKey()}`);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            // Lấy thông tin chi tiết channel để có custom URL thực tế
            const channelIds = [...new Set(data.items.map(video => video.snippet.channelId))];
            const channelDetails = await this.getChannelDetails(channelIds);
            
            const newResults = data.items.map((video, index) => {
                const searchItem = videoItems[index];
                const originalDuration = this.formatDuration(video.contentDetails.duration, video.liveStreamingDetails);
                
                // Xử lý lượt xem
                let viewCount = 'N/A';
                if (video.liveStreamingDetails && video.liveStreamingDetails.actualStartTime) {
                    // Video livestream
                    if (video.liveStreamingDetails.concurrentViewers) {
                        // Đang live - hiển thị số người xem hiện tại
                        viewCount = this.formatNumber(video.liveStreamingDetails.concurrentViewers) + ' đang xem';
                    } else if (video.statistics && video.statistics.viewCount) {
                        // Livestream đã kết thúc - hiển thị tổng lượt xem
                        viewCount = this.formatNumber(video.statistics.viewCount) + ' lượt xem (Livestream)';
                    }
                } else if (video.statistics && video.statistics.viewCount) {
                    // Video thường - hiển thị tổng lượt xem
                    viewCount = this.formatNumber(video.statistics.viewCount) + ' lượt xem';
                }
                
                // Lấy URL channel thực tế từ channel details
                const channelInfo = channelDetails.find(ch => ch.id === video.snippet.channelId);
                let channelUrl = `https://www.youtube.com/channel/${video.snippet.channelId}`; // Fallback
                
                if (channelInfo && channelInfo.snippet.customUrl) {
                    // Nếu có custom URL, sử dụng format /@customUrl
                    channelUrl = `https://www.youtube.com/@${channelInfo.snippet.customUrl.replace('@', '')}`;
                } else if (channelInfo && channelInfo.snippet.handle) {
                    // Nếu có handle, sử dụng handle
                    channelUrl = `https://www.youtube.com/@${channelInfo.snippet.handle.replace('@', '')}`;
                }
                
                // Logic mới: Kiểm tra xem video có hỗ trợ tiêu đề tiếng Anh không
                const defaultTitle = video.snippet.title; // Tiêu đề mặc định (có thể là tiếng Anh hoặc gốc)
                const defaultChannelName = video.snippet.channelTitle;
                
                // Kiểm tra xem có localized title tiếng Anh không
                let finalTitle = defaultTitle;
                let finalChannelName = defaultChannelName;
                
                if (video.localizations && video.localizations.en) {
                    // Video có hỗ trợ tiêu đề tiếng Anh
                    const englishTitle = video.localizations.en.title;
                    const englishDescription = video.localizations.en.description;
                    
                    if (englishTitle && englishTitle.trim() !== '') {
                        finalTitle = englishTitle;
                        console.log(`✅ Video ${video.id} có tiêu đề tiếng Anh: "${englishTitle.substring(0, 50)}..."`);
                    } else {
                        console.log(`🌐 Video ${video.id} không có tiêu đề tiếng Anh, giữ nguyên: "${defaultTitle.substring(0, 50)}..."`);
                    }
                } else {
                    // Video không có localized tiếng Anh
                    console.log(`🌐 Video ${video.id} không hỗ trợ tiếng Anh, giữ nguyên: "${defaultTitle.substring(0, 50)}..."`);
                }
                
                return {
                    keyword: keyword,
                    title: finalTitle,
                    originalTitle: finalTitle,
                    videoId: video.id,
                    videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
                    channelName: finalChannelName,
                    originalChannelName: finalChannelName,
                    channelId: video.snippet.channelId,
                    channelUrl: channelUrl,
                    duration: originalDuration,
                    originalDuration: originalDuration,
                    viewCount: viewCount,
                    thumbnail: video.snippet.thumbnails.medium ? video.snippet.thumbnails.medium.url : video.snippet.thumbnails.default.url,
                    summary: this.createSummary(finalChannelName, video.snippet.channelId, finalTitle, video.id, originalDuration, keyword, '', channelUrl)
                };
            });
            
            this.searchResults = this.searchResults.concat(newResults);
            
        } catch (error) {
            console.error('Video details error:', error);
            throw error;
        }
    }
    
    // Method đã được vô hiệu hóa - không dịch tự động nữa
    // YouTube API với hl=en đã xử lý việc hiển thị ngôn ngữ phù hợp
    async translateAllResults() {
        // Không làm gì cả - YouTube API đã xử lý việc hiển thị ngôn ngữ
        console.log('ℹ️ Bỏ qua dịch thuật tự động - YouTube API đã xử lý ngôn ngữ phù hợp');
        return;
    }

    // Method dịch đơn giản sử dụng Google Translate miễn phí
    async simpleTranslate(text) {
        if (!text || text.trim() === '') return text;
        
        try {
            // Sử dụng Google Translate qua mygoodtranslations.com (miễn phí)
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data && data[0] && data[0][0] && data[0][0][0]) {
                return data[0][0][0];
            }
            
            throw new Error('Google Translate response invalid');
            
        } catch (error) {
            // Fallback: sử dụng MyMemory
            try {
                const url2 = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|en`;
                const response2 = await fetch(url2);
                const data2 = await response2.json();
                
                if (data2.responseStatus === 200 && data2.responseData && data2.responseData.translatedText) {
                    return data2.responseData.translatedText;
                }
                
                throw new Error('MyMemory also failed');
                
            } catch (error2) {
                console.warn('Tất cả dịch vụ dịch đều thất bại:', error2.message);
                return text; // Trả về text gốc
            }
        }
    }

    // Kiểm tra text có phải tiếng Anh không
    isEnglish(text) {
        if (!text || text.length < 2) return true;
        
        // Kiểm tra có ký tự Unicode không (không phải ASCII)
        const hasUnicode = /[^\u0000-\u007F]/.test(text);
        
        // Nếu có ký tự Unicode, có thể không phải tiếng Anh
        if (hasUnicode) {
            return false;
        }
        
        // Kiểm tra tỷ lệ chữ cái Latin
        const latinLetters = (text.match(/[a-zA-Z]/g) || []).length;
        const totalChars = text.replace(/[\s\d\.,!?()'"@#$%^&*\-_+={}[\]\\|:;<>/~`]/g, '').length;
        
        if (totalChars === 0) return true; // Chỉ có số và ký tự đặc biệt
        
        return (latinLetters / totalChars) > 0.8; // 80% là chữ cái Latin
    }

    // Thêm method mới để lấy thông tin channel chi tiết
    async getChannelDetails(channelIds) {
        try {
            if (channelIds.length === 0) return [];
            
            const channelIdsString = channelIds.join(',');
            
            // Lấy thông tin channel với localized để kiểm tra xem có tên tiếng Anh không
            const response = await fetch(`${this.baseUrl}/channels?part=snippet,localizations&id=${channelIdsString}&hl=en&key=${this.getCurrentApiKey()}`);
            const data = await response.json();
            
            if (data.error) {
                console.warn('Error getting channel details:', data.error.message);
                return [];
            }
            
            // Xử lý kết quả để chọn tên channel phù hợp
            const processedChannels = data.items.map(channel => {
                const defaultTitle = channel.snippet.title;
                let finalTitle = defaultTitle;
                
                // Kiểm tra xem có localized title tiếng Anh không
                if (channel.localizations && channel.localizations.en) {
                    const englishTitle = channel.localizations.en.title;
                    
                    if (englishTitle && englishTitle.trim() !== '') {
                        finalTitle = englishTitle;
                        console.log(`✅ Channel ${channel.id} có tên tiếng Anh: "${englishTitle}"`);
                    } else {
                        console.log(`🌐 Channel ${channel.id} không có tên tiếng Anh, giữ nguyên: "${defaultTitle}"`);
                    }
                } else {
                    console.log(`🌐 Channel ${channel.id} không hỗ trợ tiếng Anh, giữ nguyên: "${defaultTitle}"`);
                }
                
                // Tạo channel object với tên đã được xử lý
                return {
                    ...channel,
                    snippet: {
                        ...channel.snippet,
                        title: finalTitle
                    }
                };
            });
            
            return processedChannels;
        } catch (error) {
            console.warn('Error fetching channel details:', error);
            return [];
        }
    }
    
    formatNumber(num) {
        // Format số với dấu phẩy
        return parseInt(num).toLocaleString('vi-VN');
    }
    
    formatDuration(duration, liveStreamingDetails = null) {
        // Kiểm tra nếu là video live
        if (liveStreamingDetails && liveStreamingDetails.actualStartTime) {
            // Nếu có actualEndTime, tính thời lượng từ start đến end
            if (liveStreamingDetails.actualEndTime) {
                const startTime = new Date(liveStreamingDetails.actualStartTime);
                const endTime = new Date(liveStreamingDetails.actualEndTime);
                const elapsedMs = endTime - startTime;
                
                // Chuyển đổi milliseconds thành giờ:phút:giây
                const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
                const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);
                
                if (hours > 0) {
                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                } else {
                    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            } else {
                // Nếu đang live, hiển thị thời gian từ khi bắt đầu
                const startTime = new Date(liveStreamingDetails.actualStartTime);
                const currentTime = new Date();
                const elapsedMs = currentTime - startTime;
                
                // Chuyển đổi milliseconds thành giờ:phút:giây
                const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
                const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);
                
                if (hours > 0) {
                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} (Live)`;
                } else {
                    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} (Live)`;
                }
            }
        }
        
        // Xử lý video thường
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return '00:00';
        
        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    createSummary(channelName, channelId, title, videoId, duration, keyword, customValue = '', channelUrl = null) {
        // Lấy danh sách cột được chọn (nếu có checkbox)
        const selectedColumns = this.getSelectedColumnsForSummary();
        const parts = [];
        
        // Sử dụng channelUrl được truyền vào, hoặc fallback
        if (!channelUrl) {
            channelUrl = `https://www.youtube.com/channel/${channelId}`;
        }
        
        // Extract channel handle từ channelUrl for ab_channel parameter
        let abChannelParam = channelId; // fallback to channelId
        if (channelUrl && channelUrl.includes('/@')) {
            const match = channelUrl.match(/@([^/?]+)/);
            if (match) {
                abChannelParam = '@' + match[1];
            }
        }
        
        // Map dữ liệu với custom URL thực tế
        const dataMap = {
            channelName: channelName,
            channelUrl: channelUrl, // Sử dụng custom URL thực tế
            title: title,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}&ab_channel=${abChannelParam}`,
            duration: duration,
            keyword: keyword,
            videoId: videoId
        };
        
        // Nếu có checkbox, thêm các cột được chọn theo thứ tự
        if (selectedColumns.length > 0) {
            // Thứ tự cố định theo format cũ
            const defaultOrder = ['channelName', 'channelUrl', 'title', 'videoUrl', 'duration', 'keyword'];
            
            defaultOrder.forEach(column => {
                if (selectedColumns.includes(column) && dataMap[column]) {
                    parts.push(dataMap[column]);
                }
            });
        } else {
            // Format mặc định: channelName---channelUrl---title---videoUrl---duration---keyword
            parts.push(channelName);
            parts.push(channelUrl); // Sử dụng custom URL thực tế
            parts.push(title);
            parts.push(`https://www.youtube.com/watch?v=${videoId}&ab_channel=${abChannelParam}`);
            parts.push(duration);
            parts.push(keyword);
        }
        
        let summary = parts.join('---');
        
        // Thêm các phần tùy chọn vào cuối
        const additions = this.getFormatAdditions(channelName, title);
        if (additions) {
            summary += additions;
        }
        
        // Thêm giá trị bổ sung nếu có
        if (customValue) {
            summary += `---${customValue}`;
        }
        
        return summary;
    }
    
    getSelectedColumnsForSummary() {
        const columns = [];
        
        // Thứ tự cố định theo format cũ
        const columnOrder = [
            { id: 'includeChannelName', key: 'channelName' },
            { id: 'includeChannelUrl', key: 'channelUrl' },
            { id: 'includeTitle', key: 'title' },
            { id: 'includeVideoUrl', key: 'videoUrl' },
            { id: 'includeDuration', key: 'duration' },
            { id: 'includeKeyword', key: 'keyword' },
            { id: 'includeVideoId', key: 'videoId' }
        ];
        
        columnOrder.forEach(col => {
            const element = document.getElementById(col.id);
            if (element && element.checked) {
                columns.push(col.key);
            }
        });
        
        return columns;
    }
    
    getFormatAdditions(channelName, videoTitle) {
        const addChannelName = document.getElementById('addChannelName')?.checked || false;
        const addVideoTitle = document.getElementById('addVideoTitle')?.checked || false;
        
        if (!addChannelName && !addVideoTitle) {
            return '';
        }
        
        let additions = '';
        
        // Lấy thứ tự các checkbox được tick (theo thời gian tick)
        const tickOrder = this.getTickOrder();
        
        tickOrder.forEach(option => {
            if (option === 'channelName' && addChannelName) {
                additions += `|${channelName}`;
            } else if (option === 'videoTitle' && addVideoTitle) {
                additions += `|${videoTitle}`;
            }
        });
        
        return additions;
    }
    
    getTickOrder() {
        // Trả về thứ tự các option được tick
        // Mặc định là channelName trước, videoTitle sau
        return this.tickOrder || ['channelName', 'videoTitle'];
    }
    
    updateTickOrder(option) {
        if (!this.tickOrder) {
            this.tickOrder = [];
        }
        
        // Xóa option khỏi danh sách nếu đã có
        this.tickOrder = this.tickOrder.filter(item => item !== option);
        
        // Thêm vào cuối danh sách
        this.tickOrder.push(option);
        
        console.log('Tick order updated:', this.tickOrder);
    }
    
    removeFromTickOrder(option) {
        if (this.tickOrder) {
            this.tickOrder = this.tickOrder.filter(item => item !== option);
        }
    }
    
    applyCustomValues() {
        if (this.searchResults.length === 0) {
            alert('Không có dữ liệu để áp dụng!');
            return;
        }
        
        const customDuration = document.getElementById('customDuration').value.trim();
        const customValue = document.getElementById('customValue').value.trim();
        
        // Cập nhật tất cả kết quả với giá trị tùy chỉnh
        this.searchResults.forEach(result => {
            const finalDuration = customDuration || result.originalDuration;
            result.summary = this.createSummary(
                result.channelName,
                result.channelId,
                result.title,
                result.videoId,
                finalDuration,
                result.keyword,
                customValue,
                result.channelUrl // Truyền channelUrl từ result
            );
        });
        
        // Hiển thị lại kết quả
        this.displayResults();
        
        // Thông báo thành công
        const notification = document.createElement('div');
        const addChannelName = document.getElementById('addChannelName')?.checked || false;
        const addVideoTitle = document.getElementById('addVideoTitle')?.checked || false;
        
        let formatInfo = '';
        if (addChannelName && addVideoTitle) {
            formatInfo = ' với |tên kênh và |tên video';
        } else if (addChannelName) {
            formatInfo = ' với |tên kênh';
        } else if (addVideoTitle) {
            formatInfo = ' với |tên video';
        }
        
        notification.textContent = `Đã áp dụng thành công${formatInfo}!`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4ecdc4;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            font-weight: bold;
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }
    
    displayResults() {
        const tbody = document.getElementById('resultsBody');
        tbody.innerHTML = '';
        
        this.searchResults.forEach((result, index) => {
            const row = document.createElement('tr');
            row.setAttribute('data-index', index);
            
            row.innerHTML = `
                <td class="stt-cell" onclick="toggleRowCheckbox(${index})">${index + 1}</td>
                <td class="checkbox-cell" onclick="toggleRowCheckbox(${index})">
                    <input type="checkbox" class="row-checkbox" data-index="${index}">
                </td>
                <td class="thumbnail-cell">
                    <img src="${result.thumbnail}" alt="Video thumbnail" class="video-thumbnail" onclick="showThumbnailModal('${result.thumbnail}', '${result.title.replace(/'/g, "\\'")}', '${result.channelName.replace(/'/g, "\\'")}', '${result.duration}', '${result.videoUrl}')">
                </td>
                <td>${result.keyword}</td>
                <td>${result.title}</td>
                <td>${result.videoId}</td>
                <td><a href="${result.videoUrl}" target="_blank">${result.videoUrl}</a></td>
                <td>${result.channelName}</td>
                <td><a href="${result.channelUrl}" target="_blank">${result.channelUrl}</a></td>
                <td>${result.duration}</td>
                <td>${result.viewCount}</td>
                <td>
                    <button class="comment-btn" onclick="loadVideoComments('${result.videoId}', '${result.title.replace(/'/g, "\\'")}', '${result.channelName.replace(/'/g, "\\'")}')">
                        💬 Xem
                    </button>
                </td>
                <td>
                    <span class="summary-text">${result.summary}</span>
                    <button class="copy-btn" onclick="copyToClipboard('${result.summary.replace(/'/g, "\\'")}')">Copy</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Thêm event listeners cho tất cả checkbox
        document.querySelectorAll('.row-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateCopySelectedButton();
                this.updateRowSelection(checkbox);
            });
        });
        
        document.getElementById('results').classList.remove('hidden');
        this.updateCopySelectedButton();
    }
    
    updateRowSelection(checkbox) {
        const row = checkbox.closest('tr');
        if (checkbox.checked) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    }

    toggleAllRows(checked) {
        document.querySelectorAll('.row-checkbox').forEach(checkbox => {
            checkbox.checked = checked;
            this.updateRowSelection(checkbox);
        });
        this.updateCopySelectedButton();
    }

    updateCopySelectedButton() {
        const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
        const copySelectedBtn = document.getElementById('copySelectedBtn');
        
        if (copySelectedBtn) {
            copySelectedBtn.disabled = selectedCheckboxes.length === 0;
            copySelectedBtn.textContent = `📄 Copy đã chọn (${selectedCheckboxes.length})`;
        }
        
        // Update select all checkbox state
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox && allCheckboxes.length > 0) {
            const checkedCount = selectedCheckboxes.length;
            const totalCount = allCheckboxes.length;
            
            if (checkedCount === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else if (checkedCount === totalCount) {
                selectAllCheckbox.checked = true;
                selectAllCheckbox.indeterminate = false;
            } else {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            }
        }
    }

    downloadResults() {
        if (this.searchResults.length === 0) {
            alert('Không có dữ liệu để copy!');
            return;
        }
        
        // Tạo nội dung để copy tất cả 11 cột (bao gồm STT, không bao gồm checkbox)
        const allData = this.searchResults.map((result, index) => [
            index + 1, // STT
            result.keyword,
            result.title,
            result.videoId,
            result.videoUrl,
            result.channelName,
            result.channelUrl,
            result.duration,
            result.viewCount,
            'Comment', // Placeholder cho comment
            result.summary
        ]);
        
        // Chuyển đổi thành text với tab ngăn cách
        const textToCopy = allData.map(row => row.join('\t')).join('\n');
        
        // Copy vào clipboard
        navigator.clipboard.writeText(textToCopy).then(() => {
            // Tạo thông báo tạm thời
            const notification = document.createElement('div');
            notification.textContent = 'Đã copy tất cả dữ liệu!';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4ecdc4;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 1000;
                font-weight: bold;
            `;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 2000);
        }).catch(err => {
            console.error('Copy failed:', err);
            alert('Không thể copy. Vui lòng copy thủ công.');
        });
    }
    
    copyColumn8() {
        if (this.searchResults.length === 0) {
            alert('Không có dữ liệu để copy!');
            return;
        }
        
        // Lấy tất cả dữ liệu cột 8 (summary)
        const column8Data = this.searchResults.map(result => result.summary);
        
        // Chuyển đổi thành text với xuống dòng ngăn cách
        const textToCopy = column8Data.join('\n');
        
        // Copy vào clipboard
        navigator.clipboard.writeText(textToCopy).then(() => {
            // Tạo thông báo tạm thời
            const notification = document.createElement('div');
            notification.textContent = 'Đã copy cột 8!';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4ecdc4;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 1000;
                font-weight: bold;
            `;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 2000);
        }).catch(err => {
            console.error('Copy failed:', err);
            alert('Không thể copy. Vui lòng copy thủ công.');
        });
    }
    
    updateResultsIfAvailable() {
        // Tự động cập nhật kết quả nếu đã có dữ liệu
        if (this.searchResults.length > 0) {
            const customDuration = document.getElementById('customDuration').value.trim();
            const customValue = document.getElementById('customValue').value.trim();
            
            this.searchResults.forEach(result => {
                const finalDuration = customDuration || result.originalDuration;
                result.summary = this.createSummary(
                    result.channelName,
                    result.channelId,
                    result.title,
                    result.videoId,
                    finalDuration,
                    result.keyword,
                    customValue,
                    result.channelUrl // Truyền channelUrl từ result
                );
            });
            
            this.displayResults();
        }
    }
    
    // Đảm bảo loading methods tồn tại
    showLoading() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.classList.remove('hidden');
        }
        const resultsElement = document.getElementById('results');
        if (resultsElement) {
            resultsElement.classList.add('hidden');
        }
    }
    
    hideLoading() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.classList.add('hidden');
        }
    }
    
    showError(message) {
        const errorDiv = document.getElementById('error');
        if (errorDiv) {
            const errorP = errorDiv.querySelector('p');
            if (errorP) {
                errorP.textContent = message;
            }
            errorDiv.classList.remove('hidden');
        } else {
            alert(message); // Fallback
        }
    }
    
    hideError() {
        const errorDiv = document.getElementById('error');
        if (errorDiv) {
            errorDiv.classList.add('hidden');
        }
    }

    // Thêm method mới để load comments
    async loadComments(videoId, pageToken = null) {
        try {
            // Load nhiều hơn mỗi lần để đạt target nhanh hơn
            const batchSize = Math.min(50, Math.max(20, this.targetCommentCount - this.currentCommentCount));
            
            let url = `${this.baseUrl}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${batchSize}&order=relevance&key=${this.getCurrentApiKey()}`;
            
            if (pageToken) {
                url += `&pageToken=${pageToken}`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            return {
                items: data.items || [],
                nextPageToken: data.nextPageToken || null,
                totalResults: data.pageInfo?.totalResults || 0
            };
        } catch (error) {
            console.error('Error loading comments:', error);
            throw error;
        }
    }

    // Method mới để load số lượng comment cụ thể
    async loadSpecificAmountComments(targetCount) {
        if (!this.currentVideoId || this.isLoadingComments) {
            return;
        }

        this.isLoadingComments = true;
        this.targetCommentCount = targetCount || parseInt(document.getElementById('commentLimit').value) || 50;
        this.currentCommentCount = 0;
        
        // Reset comment list
        document.getElementById('commentList').innerHTML = '';
        document.getElementById('commentLoading').classList.remove('hidden');
        document.getElementById('commentError').classList.add('hidden');
        
        // Reset pagination
        this.nextPageToken = null;
        this.hasMoreComments = true;

        try {
            while (this.currentCommentCount < this.targetCommentCount && this.hasMoreComments) {
                const result = await this.loadComments(this.currentVideoId, this.nextPageToken);
                
                if (result.items.length === 0) {
                    this.hasMoreComments = false;
                    break;
                }
                
                // Tính toán số comment cần thêm
                const remainingNeeded = this.targetCommentCount - this.currentCommentCount;
                const commentsToAdd = result.items.slice(0, remainingNeeded);
                
                // Append comments
                this.appendCommentsToList(commentsToAdd);
                this.currentCommentCount += commentsToAdd.length;
                
                // Update pagination
                this.nextPageToken = result.nextPageToken;
                this.hasMoreComments = !!result.nextPageToken && this.currentCommentCount < this.targetCommentCount;
                
                // Small delay để tránh rate limit
                if (this.hasMoreComments && this.currentCommentCount < this.targetCommentCount) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // Update UI
            document.getElementById('commentLoading').classList.add('hidden');
            
            if (this.currentCommentCount === 0) {
                document.getElementById('commentList').innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Không có comment nào</p>';
            } else if (!this.hasMoreComments && this.currentCommentCount < this.targetCommentCount) {
                this.showEndOfComments(`Đã tải hết ${this.currentCommentCount} comment có sẵn`);
            }
            
        } catch (error) {
            document.getElementById('commentLoading').classList.add('hidden');
            this.showCommentError('Không thể tải comment: ' + error.message);
            console.error('Error:', error);
        } finally {
            this.isLoadingComments = false;
        }
    }

    appendCommentsToList(comments) {
        const commentList = document.getElementById('commentList');
        
        comments.forEach((commentData, index) => {
            const comment = commentData.snippet.topLevelComment.snippet;
            const commentElement = document.createElement('div');
            commentElement.className = 'comment-item';
            commentElement.setAttribute('data-comment-index', this.getAllCommentsCount() + index);
            
            // Clean comment text (remove newlines và extra spaces)
            const cleanText = comment.textDisplay.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            
            commentElement.innerHTML = `
                <img src="${comment.authorProfileImageUrl}" alt="${comment.authorDisplayName}" class="comment-avatar">
                <div class="comment-content">
                    <div class="comment-author">${comment.authorDisplayName}</div>
                    <div class="comment-text" title="${cleanText}">${cleanText}</div>
                    <div class="comment-meta">
                        <div class="comment-likes">👍 ${comment.likeCount}</div>
                        <div class="comment-date">${new Date(comment.publishedAt).toLocaleDateString('vi-VN')}</div>
                        ${comment.totalReplyCount > 0 ? `<div class="comment-replies">💬 ${comment.totalReplyCount}</div>` : ''}
                    </div>
                </div>
                <div class="comment-actions">
                    <button class="comment-copy-btn" onclick="copyComment('${cleanText.replace(/'/g, "\\'")}')">Copy</button>
                </div>
            `;
            
            commentList.appendChild(commentElement);
        });
        
        // Update copy all button state
        this.updateCopyAllButton();
    }

    getAllCommentsCount() {
        return document.querySelectorAll('.comment-item').length;
    }

    updateCopyAllButton() {
        const copyAllBtn = document.getElementById('copyAllCommentsBtn');
        const commentCount = this.getAllCommentsCount();
        
        if (copyAllBtn) {
            copyAllBtn.disabled = commentCount === 0;
            copyAllBtn.textContent = `📋 Copy All (${commentCount})`;
        }
    }

    getAllCommentTexts() {
        const comments = [];
        document.querySelectorAll('.comment-item .comment-text').forEach(textElement => {
            const text = textElement.textContent.trim();
            if (text) {
                comments.push(text);
            }
        });
        return comments;
    }

    showInfiniteLoading() {
        let loadingDiv = document.getElementById('infiniteLoading');
        if (!loadingDiv) {
            loadingDiv = document.createElement('div');
            loadingDiv.id = 'infiniteLoading';
            loadingDiv.className = 'infinite-loading';
            loadingDiv.innerHTML = `
                <div class="spinner"></div>
                <span>Đang tải thêm comment...</span>
            `;
            document.getElementById('commentList').appendChild(loadingDiv);
        }
        loadingDiv.classList.remove('hidden');
    }

    hideInfiniteLoading() {
        const loadingDiv = document.getElementById('infiniteLoading');
        if (loadingDiv) {
            loadingDiv.classList.add('hidden');
        }
    }

    showEndOfComments(message = '🏁 Đã hiển thị hết comment') {
        let endDiv = document.getElementById('endOfComments');
        if (!endDiv) {
            endDiv = document.createElement('div');
            endDiv.id = 'endOfComments';
            endDiv.className = 'end-of-comments';
            document.getElementById('commentList').appendChild(endDiv);
        }
        endDiv.innerHTML = message;
        endDiv.classList.remove('hidden');
    }

    showCommentError(message) {
        const errorDiv = document.getElementById('commentError');
        errorDiv.querySelector('p').textContent = message;
        errorDiv.classList.remove('hidden');
    }

    selectAllRows() {
        document.querySelectorAll('.row-checkbox').forEach(checkbox => {
            checkbox.checked = true;
            checkbox.closest('tr').classList.add('selected');
        });
        document.getElementById('selectAllCheckbox').checked = true;
        this.updateCopySelectedButton();
    }

    deselectAllRows() {
        document.querySelectorAll('.row-checkbox').forEach(checkbox => {
            checkbox.checked = false;
            checkbox.closest('tr').classList.remove('selected');
        });
        document.getElementById('selectAllCheckbox').checked = false;
        this.updateCopySelectedButton();
    }

    toggleAllRows(checked) {
        document.querySelectorAll('.row-checkbox').forEach(checkbox => {
            checkbox.checked = checked;
            if (checked) {
                checkbox.closest('tr').classList.add('selected');
            } else {
                checkbox.closest('tr').classList.remove('selected');
            }
        });
        this.updateCopySelectedButton();
    }

    updateCopySelectedButton() {
        const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
        const copySelectedBtn = document.getElementById('copySelectedBtn');
        
        if (copySelectedBtn) {
            copySelectedBtn.disabled = selectedCheckboxes.length === 0;
            copySelectedBtn.textContent = `📄 Copy đã chọn (${selectedCheckboxes.length})`;
        }
        
        // Update select all checkbox state
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox && allCheckboxes.length > 0) {
            const checkedCount = selectedCheckboxes.length;
            const totalCount = allCheckboxes.length;
            
            if (checkedCount === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else if (checkedCount === totalCount) {
                selectAllCheckbox.checked = true;
                selectAllCheckbox.indeterminate = false;
            } else {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            }
        }
    }

    copySelectedRows() {
        const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
        
        if (selectedCheckboxes.length === 0) {
            alert('Vui lòng chọn ít nhất một dòng để copy!');
            return;
        }
        
        // Chỉ lấy phần tổng hợp (summary) của những hàng đã chọn
        const selectedSummaries = Array.from(selectedCheckboxes).map(checkbox => {
            const index = parseInt(checkbox.dataset.index);
            const result = this.searchResults[index];
            return result.summary;
        });
        
        // Chuyển đổi thành text với xuống dòng ngăn cách (giống như Copy cột 8)
        const textToCopy = selectedSummaries.join('\n');
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            showNotification(`Đã copy tổng hợp của ${selectedCheckboxes.length} dòng đã chọn!`, 3000);
        }).catch(err => {
            console.error('Copy failed:', err);
            alert('Không thể copy. Vui lòng copy thủ công.');
        });
    }
}

// Global functions
function copyComment(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Đã copy comment!');
    }).catch(err => {
        console.error('Copy failed:', err);
        alert('Không thể copy. Vui lòng copy thủ công.');
    });
}

function copyAllComments() {
    const toolInstance = window.youtubeSearchTool;
    const comments = toolInstance.getAllCommentTexts();
    
    if (comments.length === 0) {
        alert('Không có comment nào để copy!');
        return;
    }
    
    // Chỉ copy text comment, mỗi comment một dòng
    const textToCopy = comments.join('\n');
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        showNotification(`Đã copy ${comments.length} comments!`, 3000);
    }).catch(err => {
        console.error('Copy failed:', err);
        
        // Fallback: tạo textarea để user có thể copy manual
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            showNotification(`Đã copy ${comments.length} comments!`, 3000);
        } catch (err) {
            alert('Không thể copy tự động. Vui lòng copy thủ công.');
        }
        
        document.body.removeChild(textarea);
    });
}

function loadSpecificAmountComments() {
    const loadBtn = document.getElementById('loadCommentsBtn');
    const input = document.getElementById('commentLimit');
    const targetCount = parseInt(input.value);
    
    if (!targetCount || targetCount < 10 || targetCount > 500) {
        alert('Vui lòng nhập số từ 10 đến 500');
        return;
    }
    
    // Update UI
    loadBtn.classList.add('loading');
    loadBtn.disabled = true;
    
    const toolInstance = window.youtubeSearchTool;
    toolInstance.loadSpecificAmountComments(targetCount).finally(() => {
        loadBtn.classList.remove('loading');
        loadBtn.disabled = false;
    });
}

function showNotification(message, duration = 2000) {
    // Remove existing notification
    const existingNotification = document.getElementById('copyNotification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
        const notification = document.createElement('div');
    notification.id = 'copyNotification';
    notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4ecdc4;
            color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 3000;
            font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
        document.body.appendChild(notification);
        
        setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, duration);
}

// Global functions cho thumbnail modal
function showThumbnailModal(thumbnailUrl, videoTitle, channelName, duration, videoUrl) {
    // Hiển thị modal
    document.getElementById('thumbnailModal').classList.remove('hidden');
    
    // Set thumbnail image
    document.getElementById('zoomedThumbnail').src = thumbnailUrl;
    
    // Set video info
    document.getElementById('thumbnailVideoTitle').textContent = videoTitle;
    document.getElementById('thumbnailVideoChannel').textContent = channelName;
    document.getElementById('thumbnailVideoDuration').textContent = `Thời lượng: ${duration}`;
    
    // Store video URL for open button
    document.getElementById('openVideoBtn').setAttribute('data-video-url', videoUrl);
}

function closeThumbnailModal() {
    document.getElementById('thumbnailModal').classList.add('hidden');
}

function openVideoFromThumbnail() {
    const videoUrl = document.getElementById('openVideoBtn').getAttribute('data-video-url');
    if (videoUrl) {
        window.open(videoUrl, '_blank');
    }
}

// Global functions cho modal
async function loadVideoComments(videoId, title, channelName) {
    // Hiển thị modal
    document.getElementById('commentModal').classList.remove('hidden');
    
    // Set video info
    document.getElementById('commentVideoTitle').textContent = title;
    document.getElementById('commentVideoChannel').textContent = channelName;
    
    // Reset states
    document.getElementById('commentLoading').classList.remove('hidden');
    document.getElementById('commentList').innerHTML = '';
    document.getElementById('commentError').classList.add('hidden');
    
    // Reset copy all button
    const copyAllBtn = document.getElementById('copyAllCommentsBtn');
    if (copyAllBtn) {
        copyAllBtn.disabled = true;
        copyAllBtn.textContent = '📋 Copy All (0)';
    }
    
    // Reset load button
    const loadBtn = document.getElementById('loadCommentsBtn');
    if (loadBtn) {
        loadBtn.disabled = false;
        loadBtn.classList.remove('loading');
    }
    
    // Set up tool instance
    const toolInstance = window.youtubeSearchTool;
    toolInstance.currentVideoId = videoId;
    toolInstance.nextPageToken = null;
    toolInstance.isLoadingComments = false;
    toolInstance.hasMoreComments = true;
    toolInstance.currentCommentCount = 0;
    
    // Load initial amount
    const initialCount = parseInt(document.getElementById('commentLimit').value) || 50;
    
    try {
        await toolInstance.loadSpecificAmountComments(initialCount);
    } catch (error) {
        document.getElementById('commentLoading').classList.add('hidden');
        document.getElementById('commentError').classList.remove('hidden');
        console.error('Error:', error);
    }
}

function setupInfiniteScroll() {
    const commentList = document.getElementById('commentList');
    
    // Remove existing scroll listener
    commentList.removeEventListener('scroll', handleCommentScroll);
    
    // Add new scroll listener
    commentList.addEventListener('scroll', handleCommentScroll);
}

function handleCommentScroll() {
    const commentList = document.getElementById('commentList');
    const toolInstance = window.youtubeSearchTool;
    
    // Check if user scrolled near bottom (within 50px)
    if (commentList.scrollTop + commentList.clientHeight >= commentList.scrollHeight - 50) {
        if (!toolInstance.isLoadingComments && toolInstance.hasMoreComments) {
            toolInstance.loadMoreComments();
        }
    }
}

function closeCommentModal() {
    document.getElementById('commentModal').classList.add('hidden');
    
    // Clean up scroll listener
    const commentList = document.getElementById('commentList');
    if (commentList) {
        commentList.removeEventListener('scroll', handleCommentScroll);
    }
    
    // Reset state
    const toolInstance = window.youtubeSearchTool;
    if (toolInstance) {
        toolInstance.currentVideoId = null;
        toolInstance.nextPageToken = null;
        toolInstance.isLoadingComments = false;
        toolInstance.hasMoreComments = true;
        toolInstance.currentCommentCount = 0; // Reset comment count
    }
}

// Close modal khi click outside
window.onclick = function(event) {
    const commentModal = document.getElementById('commentModal');
    const thumbnailModal = document.getElementById('thumbnailModal');
    
    if (event.target == commentModal) {
        closeCommentModal();
    } else if (event.target == thumbnailModal) {
        closeThumbnailModal();
    }
}

// Keyboard shortcut để đóng modal (ESC)
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const commentModal = document.getElementById('commentModal');
        const thumbnailModal = document.getElementById('thumbnailModal');
        
        if (!commentModal.classList.contains('hidden')) {
            closeCommentModal();
        } else if (!thumbnailModal.classList.contains('hidden')) {
            closeThumbnailModal();
        }
    }
});

// Cập nhật phần khởi tạo
document.addEventListener('DOMContentLoaded', () => {
    window.youtubeSearchTool = new YouTubeSearchTool();
});

// Global function để toggle checkbox khi click vào cell
function toggleRowCheckbox(index) {
    const checkbox = document.querySelector(`.row-checkbox[data-index="${index}"]`);
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
    }
}

// Function để toggle select all khi click vào header
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const toolInstance = window.youtubeSearchTool;
    
    if (selectAllCheckbox && toolInstance) {
        selectAllCheckbox.checked = !selectAllCheckbox.checked;
        toolInstance.toggleAllRows(selectAllCheckbox.checked);
    }
}

// Global function để remove API key
function removeApiKey(index) {
    const toolInstance = window.youtubeSearchTool;
    if (toolInstance) {
        toolInstance.removeApiKeyAt(index);
    }
}
