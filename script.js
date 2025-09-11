class YouTubeSearchTool {
    constructor() {
        this.apiKey = 'AIzaSyBjOpGZloLYRODbhLHmwBHAiDGW5gyL-kA';
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';
        this.searchResults = [];
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        document.getElementById('searchBtn').addEventListener('click', () => this.searchVideos());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadResults());
        document.getElementById('copyColumn8Btn').addEventListener('click', () => this.copyColumn8());
        
        // Enter key để tìm kiếm
        document.getElementById('searchKeyword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchVideos();
            }
        });
    }
    
    async searchVideos() {
        const keywordInput = document.getElementById('searchKeyword').value.trim();
        const videoCount = parseInt(document.getElementById('videoCount').value);
        
        if (!keywordInput) {
            alert('Vui lòng nhập từ khóa tìm kiếm!');
            return;
        }
        
        // Tách từ khóa bằng dấu |
        const keywords = keywordInput.split('|').map(k => k.trim()).filter(k => k.length > 0);
        
        if (keywords.length === 0) {
            alert('Vui lòng nhập ít nhất một từ khóa!');
            return;
        }
        
        this.showLoading();
        this.hideError();
        
        // Xóa kết quả cũ
        this.searchResults = [];
        
        try {
            const filters = this.getSearchFilters();
            
            // Tìm kiếm cho từng từ khóa
            for (const keyword of keywords) {
                await this.searchSingleKeyword(keyword, videoCount, filters);
                
                // Thêm delay nhỏ giữa các request để tránh rate limit
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            if (this.searchResults.length > 0) {
                this.displayResults();
                document.getElementById('downloadBtn').disabled = false;
                document.getElementById('copyColumn8Btn').disabled = false;
            } else {
                this.showError('Không tìm thấy video nào với các từ khóa này.');
            }
            
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Có lỗi xảy ra khi tìm kiếm: ' + error.message);
        }
        
        this.hideLoading();
    }
    
    async searchSingleKeyword(keyword, videoCount, filters) {
        const searchParams = {
            part: 'snippet',
            q: keyword,
            type: 'video',
            maxResults: Math.min(videoCount, 50),
            key: this.apiKey,
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
    
    async getVideoDetails(videoItems, keyword) {
        try {
            const videoIds = videoItems.map(item => item.id.videoId).join(',');
            // Thêm part 'liveStreamingDetails' để lấy thông tin video live
            const response = await fetch(`${this.baseUrl}/videos?part=snippet,contentDetails,liveStreamingDetails&id=${videoIds}&key=${this.apiKey}`);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            const newResults = data.items.map((video, index) => {
                const searchItem = videoItems[index];
                const duration = this.formatDuration(video.contentDetails.duration, video.liveStreamingDetails);
                return {
                    keyword: keyword,
                    title: video.snippet.title,
                    videoId: video.id,
                    videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
                    channelName: video.snippet.channelTitle,
                    channelUrl: `https://www.youtube.com/channel/${video.snippet.channelId}`,
                    duration: duration,
                    summary: this.createSummary(video.snippet.channelTitle, video.snippet.channelId, video.snippet.title, video.id, duration, keyword)
                };
            });
            
            // Thêm kết quả mới vào danh sách hiện tại
            this.searchResults = this.searchResults.concat(newResults);
            
        } catch (error) {
            console.error('Video details error:', error);
            this.showError('Có lỗi xảy ra khi lấy thông tin video: ' + error.message);
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
    
    createSummary(channelName, channelId, title, videoId, duration, keyword) {
        return `${channelName}---https://www.youtube.com/channel/${channelId}---${title}---https://www.youtube.com/watch?v=${videoId}&ab_channel=${channelId}---${duration}---${keyword}`;
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
    
    generateCSV() {
        const headers = ['Từ khóa', 'Tiêu đề video', 'Link video (ID)', 'Link video (Full)', 'Tên kênh', 'Link kênh', 'Thời lượng', 'Tổng hợp'];
        const rows = this.searchResults.map(result => [
            result.keyword,
            `"${result.title}"`,
            result.videoId,
            result.videoUrl,
            result.channelName,
            result.channelUrl,
            result.duration,
            `"${result.summary}"`
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
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
