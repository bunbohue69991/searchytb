class YouTubeSearchTool {
    constructor() {
        // Không còn sử dụng API key cố định
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
        this.searchResults = [];
        
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
        
        // Format checkbox events
        document.getElementById('addChannelName').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.updateTickOrder('channelName');
            } else {
                this.removeFromTickOrder('channelName');
            }
            this.updateResultsIfAvailable();
        });
        
        document.getElementById('addVideoTitle').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.updateTickOrder('videoTitle');
            } else {
                this.removeFromTickOrder('videoTitle');
            }
            this.updateResultsIfAvailable();
        });
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
    
    async searchSingleKeywordWithRetry(keyword, videoCount, filters, retryCount = 0) {
        const maxRetries = 1; // Only retry once for now, as we are using a single API key
        
        try {
            await this.searchSingleKeyword(keyword, videoCount, filters);
        } catch (error) {
            if (error.message.includes('quota') && retryCount < maxRetries) {
                console.log(`API key hết quota, chuyển sang API key tiếp theo...`);
                // No next API key to switch to, as we are using a single key
                throw new Error('Tất cả API key đã hết quota. Vui lòng thử lại sau.');
            } else {
                throw error;
            }
        }
    }
    
    async searchSingleKeyword(keyword, videoCount, filters) {
        const searchParams = {
            part: 'snippet',
            q: keyword,
            type: 'video',
            maxResults: Math.min(videoCount, 50),
            key: this.getCurrentApiKey(), // Sử dụng API key từ input
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
    
    async getVideoDetailsWithRetry(videoItems, keyword, retryCount = 0) {
        const maxRetries = 1; // Only retry once for now, as we are using a single API key
        
        try {
            await this.getVideoDetails(videoItems, keyword);
        } catch (error) {
            if (error.message.includes('quota') && retryCount < maxRetries) {
                console.log(`API key hết quota trong getVideoDetails, chuyển sang API key tiếp theo...`);
                // No next API key to switch to, as we are using a single key
                throw new Error('Tất cả API key đã hết quota. Vui lòng thử lại sau.');
            } else {
                throw error;
            }
        }
    }
    
    async getVideoDetails(videoItems, keyword) {
        try {
            const videoIds = videoItems.map(item => item.id.videoId).join(',');
            const response = await fetch(`${this.baseUrl}/videos?part=snippet,contentDetails,liveStreamingDetails&id=${videoIds}&key=${this.getCurrentApiKey()}`);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            const newResults = data.items.map((video, index) => {
                const searchItem = videoItems[index];
                const originalDuration = this.formatDuration(video.contentDetails.duration, video.liveStreamingDetails);
                
                return {
                    keyword: keyword,
                    title: video.snippet.title,
                    videoId: video.id,
                    videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
                    channelName: video.snippet.channelTitle,
                    channelUrl: `https://www.youtube.com/channel/${video.snippet.channelId}`,
                    duration: originalDuration,
                    originalDuration: originalDuration,
                    summary: this.createSummary(video.snippet.channelTitle, video.snippet.channelId, video.snippet.title, video.id, originalDuration, keyword, '')
                };
            });
            
            this.searchResults = this.searchResults.concat(newResults);
            
        } catch (error) {
            console.error('Video details error:', error);
            throw error;
        }
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
        // Format cơ bản
        let summary = `${channelName}---https://www.youtube.com/channel/${channelId}---${title}---https://www.youtube.com/watch?v=${videoId}&ab_channel=${channelId}---${duration}---${keyword}`;
        
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
                result.channelUrl.split('/').pop(),
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
        const addChannelName = document.getElementById('addChannelName').checked;
        const addVideoTitle = document.getElementById('addVideoTitle').checked;
        
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
        
        // Tạo nội dung để copy tất cả 8 cột
        const allData = this.searchResults.map(result => [
            result.keyword,
            result.title,
            result.videoId,
            result.videoUrl,
            result.channelName,
            result.channelUrl,
            result.duration,
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

    updateResultsIfAvailable() {
        // Tự động cập nhật kết quả nếu đã có dữ liệu
        if (this.searchResults.length > 0) {
            const customDuration = document.getElementById('customDuration').value.trim();
            const customValue = document.getElementById('customValue').value.trim();
            
            this.searchResults.forEach(result => {
                const finalDuration = customDuration || result.originalDuration;
                result.summary = this.createSummary(
                    result.channelName,
                    result.channelUrl.split('/').pop(),
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
}

// Hàm copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Tạo thông báo tạm thời
        const notification = document.createElement('div');
        notification.textContent = 'Đã copy!';
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

// Khởi tạo ứng dụng khi trang được tải
document.addEventListener('DOMContentLoaded', () => {
    new YouTubeSearchTool();
});
