class YouTubeSearchTool {
    constructor() {
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
        this.searchResults = [];
        
        // Thêm biến cho comment pagination
        this.currentVideoId = null;
        this.nextPageToken = null;
        this.isLoadingComments = false;
        this.hasMoreComments = true;
        
        // Thêm biến cho comment management
        this.targetCommentCount = 50; // Default số lượng comment muốn load
        this.currentCommentCount = 0;
        
        this.initializeEventListeners();
        this.loadSavedApiKey();
    }
    
    getCurrentApiKey() {
        const apiKeyInput = document.getElementById('apiKeyInput');
        return apiKeyInput.value.trim();
    }
    
    loadSavedApiKey() {
        // Tải API key đã lưu từ localStorage
        const savedApiKey = localStorage.getItem('youtube_api_key');
        if (savedApiKey) {
            document.getElementById('apiKeyInput').value = savedApiKey;
            this.validateApiKey();
        }
    }
    
    saveApiKey() {
        // Lưu API key vào localStorage
        const apiKey = this.getCurrentApiKey();
        if (apiKey) {
            localStorage.setItem('youtube_api_key', apiKey);
        } else {
            localStorage.removeItem('youtube_api_key');
        }
    }
    
    async validateApiKey() {
        const apiKey = this.getCurrentApiKey();
        const statusElement = document.getElementById('apiStatus');
        
        if (!apiKey) {
            statusElement.textContent = '❌ Chưa nhập API Key';
            statusElement.className = 'api-status invalid';
            return false;
        }
        
        try {
            // Test API key bằng một request đơn giản
            const response = await fetch(`${this.baseUrl}/search?part=snippet&q=test&maxResults=1&key=${apiKey}`);
            const data = await response.json();
            
            if (data.error) {
                statusElement.textContent = '❌ API Key không hợp lệ: ' + data.error.message;
                statusElement.className = 'api-status invalid';
                return false;
            } else {
                statusElement.textContent = '✅ API Key hợp lệ';
                statusElement.className = 'api-status valid';
                this.saveApiKey();
                return true;
            }
        } catch (error) {
            statusElement.textContent = '❌ Không thể kiểm tra API Key';
            statusElement.className = 'api-status invalid';
            return false;
        }
    }
    
    createAtUsername(channelName) {
        // Chuyển tên kênh thành @username
        return channelName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '') // Chỉ giữ chữ và số
            .replace(/\s+/g, ''); // Xóa khoảng trắng
    }
    
    initializeEventListeners() {
        document.getElementById('searchBtn').addEventListener('click', () => this.searchVideos());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadResults());
        document.getElementById('copyColumn8Btn').addEventListener('click', () => this.copyColumn8());
        document.getElementById('applyBtn').addEventListener('click', () => this.applyCustomValues());
        
        // API Key events
        const apiKeyInput = document.getElementById('apiKeyInput');
        const toggleBtn = document.getElementById('toggleApiKey');
        
        apiKeyInput.addEventListener('input', () => {
            // Reset status khi user thay đổi
            const statusElement = document.getElementById('apiStatus');
            statusElement.textContent = '⏳ Nhập API Key và bấm tìm kiếm để kiểm tra';
            statusElement.className = 'api-status';
        });
        
        apiKeyInput.addEventListener('blur', () => {
            this.saveApiKey();
        });
        
        toggleBtn.addEventListener('click', () => {
            if (apiKeyInput.type === 'password') {
                apiKeyInput.type = 'text';
                toggleBtn.textContent = '🙈';
            } else {
                apiKeyInput.type = 'password';
                toggleBtn.textContent = '👁️';
            }
        });
        
        // Column checkbox events - kiểm tra xem element có tồn tại không
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
    
    async searchVideos() {
        // Kiểm tra API key trước khi tìm kiếm
        const apiKey = this.getCurrentApiKey();
        if (!apiKey) {
            alert('Vui lòng nhập YouTube API Key trước khi tìm kiếm!');
            document.getElementById('apiKeyInput').focus();
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
            // Validate API key trước khi bắt đầu tìm kiếm
            const isValidKey = await this.validateApiKey();
            if (!isValidKey) {
                throw new Error('API Key không hợp lệ. Vui lòng kiểm tra lại.');
            }
            
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
                document.getElementById('applyBtn').disabled = false;
            } else {
                this.showError('Không tìm thấy video nào với các từ khóa này.');
            }
            
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Có lỗi xảy ra khi tìm kiếm: ' + error.message);
        }
        
        this.hideLoading();
    }
    
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
    
    getSearchFilters() {
        const filters = {};
        
        // Bộ lọc ngày tải lên - sử dụng publishedAfter
        const uploadDate = document.getElementById('uploadDate').value;
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
        const type = document.getElementById('type').value;
        if (type) {
            filters.type = type;
        }
        
        // Bộ lọc thời lượng - sử dụng videoDuration
        const duration = document.getElementById('duration').value;
        if (duration) {
            filters.videoDuration = duration;
        }
        
        // Bộ lọc tính năng
        const features = document.getElementById('features').value;
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
        const sortBy = document.getElementById('sortBy').value;
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
    
    async searchSingleKeyword(keyword, videoCount, filters) {
        const searchParams = {
            part: 'snippet',
            q: keyword,
            type: 'video',
            maxResults: Math.min(videoCount, 50),
            key: this.getCurrentApiKey(),
            ...filters
        };
        
        const response = await fetch(`${this.baseUrl}/search?${new URLSearchParams(searchParams)}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }
        
        if (data.items && data.items.length > 0) {
            await this.getVideoDetails(data.items, keyword);
        }
    }
    
    async getVideoDetails(videoItems, keyword) {
        try {
            const videoIds = videoItems.map(item => item.id.videoId).join(',');
            // Thêm statistics để lấy lượt xem
            const response = await fetch(`${this.baseUrl}/videos?part=snippet,contentDetails,liveStreamingDetails,statistics&id=${videoIds}&key=${this.getCurrentApiKey()}`);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            const newResults = data.items.map((video, index) => {
                const searchItem = videoItems[index];
                const originalDuration = this.formatDuration(video.contentDetails.duration, video.liveStreamingDetails);
                
                // Xử lý lượt xem
                let viewCount = 'N/A';
                if (video.liveStreamingDetails && video.liveStreamingDetails.concurrentViewers) {
                    // Video live - hiển thị số người xem hiện tại
                    viewCount = this.formatNumber(video.liveStreamingDetails.concurrentViewers) + ' đang xem';
                } else if (video.statistics && video.statistics.viewCount) {
                    // Video thường - hiển thị tổng lượt xem
                    viewCount = this.formatNumber(video.statistics.viewCount) + ' lượt xem';
                }
                
                return {
                    keyword: keyword,
                    title: video.snippet.title,
                    videoId: video.id,
                    videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
                    channelName: video.snippet.channelTitle,
                    channelId: video.snippet.channelId,
                    channelUrl: `https://www.youtube.com/@${this.createAtUsername(video.snippet.channelTitle)}`, // Hiển thị @username
                    duration: originalDuration,
                    originalDuration: originalDuration,
                    viewCount: viewCount,
                    summary: this.createSummary(video.snippet.channelTitle, video.snippet.channelId, video.snippet.title, video.id, originalDuration, keyword, '')
                };
            });
            
            this.searchResults = this.searchResults.concat(newResults);
            
        } catch (error) {
            console.error('Video details error:', error);
            throw error;
        }
    }
    
    formatNumber(num) {
        // Format số với dấu phẩy
        return parseInt(num).toLocaleString('vi-VN');
    }
    
    formatDuration(duration, liveStreamingDetails = null) {
        // Kiểm tra nếu là video live
        if (liveStreamingDetails && liveStreamingDetails.actualStartTime) {
            const startTime = new Date(liveStreamingDetails.actualStartTime);
            const currentTime = new Date();
            const elapsedMs = currentTime - startTime;
            
            // Chuyển đổi milliseconds thành giờ:phút:giây
            const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
            const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);
            
            if (hours > 0) {
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
    
    createSummary(channelName, channelId, title, videoId, duration, keyword, customValue = '') {
        // Lấy danh sách cột được chọn (nếu có checkbox)
        const selectedColumns = this.getSelectedColumnsForSummary();
        const parts = [];
        
        // Map dữ liệu với format cũ (sử dụng channel URL cũ)
        const dataMap = {
            channelName: channelName,
            channelUrl: `https://www.youtube.com/channel/${channelId}`, // Format cũ /channel/UCxxxx
            title: title,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}&ab_channel=${channelId}`,
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
            // Format mặc định như cũ: channelName---channelUrl---title---videoUrl---duration---keyword
            parts.push(channelName);
            parts.push(`https://www.youtube.com/channel/${channelId}`);
            parts.push(title);
            parts.push(`https://www.youtube.com/watch?v=${videoId}&ab_channel=${channelId}`);
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
                customValue
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
            row.innerHTML = `
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
        
        document.getElementById('results').classList.remove('hidden');
    }
    
    downloadResults() {
        if (this.searchResults.length === 0) {
            alert('Không có dữ liệu để copy!');
            return;
        }
        
        // Tạo nội dung để copy tất cả 9 cột
        const allData = this.searchResults.map(result => [
            result.keyword,
            result.title,
            result.videoId,
            result.videoUrl,
            result.channelName,
            result.channelUrl,
            result.duration,
            result.viewCount,
            'Comment', // Placeholder cho cột comment
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
                    customValue
                );
            });
            
            this.displayResults();
        }
    }
    
    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('results').classList.add('hidden');
    }
    
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }
    
    showError(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.querySelector('p').textContent = message;
        errorDiv.classList.remove('hidden');
    }
    
    hideError() {
        document.getElementById('error').classList.add('hidden');
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
    const modal = document.getElementById('commentModal');
    if (event.target == modal) {
        closeCommentModal();
    }
}

// Keyboard shortcut để đóng modal (ESC)
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('commentModal');
        if (!modal.classList.contains('hidden')) {
            closeCommentModal();
        }
    }
});

// Cập nhật phần khởi tạo
document.addEventListener('DOMContentLoaded', () => {
    window.youtubeSearchTool = new YouTubeSearchTool();
});
