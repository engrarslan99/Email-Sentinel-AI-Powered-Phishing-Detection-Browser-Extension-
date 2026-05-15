document.addEventListener("DOMContentLoaded", async () => {
    const statusDiv = document.getElementById("status");
    const scoreContainer = document.getElementById("score-container");
    const scoreDiv = document.getElementById("score");
    const urlsSection = document.getElementById("urls-section");
    const urlsDiv = document.getElementById("urls");
    const urlHeaderText = document.getElementById("url-header-text");

    function getRiskLevelInfo(trustScore) {
        const score = parseFloat(trustScore) || 0;
        
        if (score >= 85) {
            return {
                className: 'risk-safe',
                icon: '✅',
                text: 'Safe',
                description: 'This email is safe'
            };
        } else if (score >= 65) {
            return {
                className: 'risk-likely-safe',
                icon: '🟢',
                text: 'Likely Safe',
                description: 'This email appears to be safe'
            };
        } else if (score >= 45) {
            return {
                className: 'risk-suspicious',
                icon: '🟡',
                text: 'Suspicious',
                description: 'Exercise caution with this email'
            };
        } else if (score >= 25) {
            return {
                className: 'risk-risky',
                icon: '🟠',
                text: 'High Risk',
                description: 'This email may be dangerous'
            };
        } else {
            return {
                className: 'risk-dangerous',
                icon: '🚨',
                text: 'Critical Risk',
                description: 'This email is extremely dangerous'
            };
        }
    }

    function createUrlItem(url, isSuspicious, ruleThreats = [], apiThreats = {}) {
        const urlItem = document.createElement('div');
        urlItem.className = 'url-item';
        
        const statusIcon = document.createElement('svg');
        statusIcon.className = 'status-icon';
        statusIcon.viewBox = '0 0 24 24';
        
        const sbThreat = apiThreats.safeBrowsing || false;
        const apiDetected = sbThreat;
        
        if (isSuspicious || apiDetected) {
            statusIcon.classList.add('warning-icon');
            statusIcon.innerHTML = '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>';
            urlItem.classList.add('url-suspicious');
            
            if (apiDetected) {
                urlItem.classList.add('api-detected');
            }
        } else {
            statusIcon.classList.add('safe-icon');
            statusIcon.innerHTML = '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>';
            urlItem.classList.add('url-safe');
        }
        
        const urlContent = document.createElement('div');
        urlContent.style.flex = '1';
        
        const urlText = document.createElement('span');
        urlText.textContent = url;
        urlText.style.wordBreak = 'break-all';
        urlContent.appendChild(urlText);
        
        if (apiDetected) {
            const apiIndicators = document.createElement('div');
            apiIndicators.className = 'api-indicators';
            
            if (sbThreat) {
                const sbBadge = document.createElement('span');
                sbBadge.className = 'api-badge sb';
                sbBadge.textContent = 'Google SB';
                sbBadge.title = 'Flagged by Google Safe Browsing';
                apiIndicators.appendChild(sbBadge);
            }
            
            urlContent.appendChild(apiIndicators);
        }
        
        urlItem.appendChild(statusIcon);
        urlItem.appendChild(urlContent);
        
        const allThreats = [...ruleThreats];
        if (sbThreat) allThreats.push('🛡️ Google Safe Browsing: Harmful content detected');
        
        if (allThreats.length > 0) {
            urlItem.title = allThreats.join('\n• ');
        }
        
        return urlItem;
    }

    function extractUrlsFromContent(subject, body) {
        const urlRegex = /(https?:\/\/(?:[-\w.])+(?:[:\d]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?|www\.(?:[-\w.])+(?:[:\d]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[^\s<>"'\[\]{}|\\^`]*)?)/gi;
        
        const content = `${subject} ${body}`;
        const matches = content.match(urlRegex) || [];
        
        const cleanUrls = matches.map(url => {
            url = url.replace(/[.,;:!?)\]}>]+$/, '');
            
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                if (url.startsWith('www.')) {
                    return `https://${url}`;
                } else if (url.includes('.') && !url.includes(' ')) {
                    const parts = url.split('.');
                    if (parts.length >= 2 && parts[parts.length - 1].length >= 2) {
                        return `https://${url}`;
                    }
                }
            }
            return url;
        })
        .filter(url => {
            if (url.includes(' ') || url.length < 4) return false;
            
            try {
                const urlObj = new URL(url);
                return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
            } catch {
                return false;
            }
        })
        .filter((url, index, self) => self.indexOf(url) === index); 
        
        return cleanUrls;
    }

    function getSafeBrowsingThreatsForUrl(url, apiAnalysis) {
        const sbData = apiAnalysis || {};
        let sbThreat = false;
        
        if (sbData.malicious_urls && Array.isArray(sbData.malicious_urls)) {
            sbThreat = sbData.malicious_urls.some(maliciousUrl => 
                maliciousUrl === url || url.includes(maliciousUrl) || maliciousUrl.includes(url)
            );
        }
        
        return {
            safeBrowsing: sbThreat
        };
    }

    function displayGoogleSafeBrowsingStatus(apiStatus, totalUrls, maliciousCount, scoreContainer) {
        const existingStatus = scoreContainer.querySelectorAll('.integration-status, .api-summary');
        existingStatus.forEach(el => el.remove());

        const apiStatusDiv = document.createElement('div');
        
        if (totalUrls === 0) {
            apiStatusDiv.className = 'integration-status no-urls';
            apiStatusDiv.innerHTML = `ℹ️ No URLs detected in email content`;
            scoreContainer.appendChild(apiStatusDiv);
            return;
        }

        if (apiStatus === 'success' || (totalUrls > 0 && maliciousCount >= 0)) {
            apiStatusDiv.className = 'integration-status connected';
            if (maliciousCount > 0) {
                apiStatusDiv.innerHTML = `🚨 Google Safe Browsing: ${maliciousCount} threat${maliciousCount > 1 ? 's' : ''} detected (${totalUrls} URLs scanned)`;
            } else {
                apiStatusDiv.innerHTML = `✅ Google Safe Browsing: All ${totalUrls} URL${totalUrls > 1 ? 's' : ''} verified safe`;
            }
        } else if (apiStatus === 'unavailable') {
            apiStatusDiv.className = 'integration-status disconnected';
            apiStatusDiv.innerHTML = `⚠️ Google Safe Browsing: Service temporarily unavailable - using rule-based analysis`;
        } else if (apiStatus === 'rate_limited') {
            apiStatusDiv.className = 'integration-status disconnected';
            apiStatusDiv.innerHTML = `⏱️ Google Safe Browsing: Rate limit reached - using cached results`;
        } else if (apiStatus === 'error') {
            apiStatusDiv.className = 'integration-status disconnected';
            apiStatusDiv.innerHTML = `❌ Google Safe Browsing: Service error - analyzing with rules only`;
        } else {
            apiStatusDiv.className = 'integration-status connected';
            apiStatusDiv.innerHTML = `✅ Google Safe Browsing: All ${totalUrls} URL${totalUrls > 1 ? 's' : ''} verified safe`;
        }
        
        scoreContainer.appendChild(apiStatusDiv);
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab.url;

    if (!url.includes("mail.google.com") && !url.includes("outlook.live.com")) {
        statusDiv.innerHTML = `
            <span>⚠️</span>
            <span>Please open Gmail or Outlook to analyze emails</span>
        `;
        statusDiv.className = "warning-state";
        return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "extract_email" }, async (response) => {
        if (!response || !response.sender) {
            statusDiv.innerHTML = `
                <span>⚠️</span>
                <span>No email found. Please select an email to analyze.</span>
            `;
            statusDiv.className = "warning-state";
            return;
        }

        if (!response.urls || response.urls.length === 0) {
            response.urls = extractUrlsFromContent(response.subject || '', response.body || '');
        }

        statusDiv.innerHTML = `
            <span>⏳</span>
            <span>Analyzing email security with AI + Google Safe Browsing...</span>
        `;
        statusDiv.className = "status-loading";
        
        try {
            const res = await fetch("http://127.0.0.1:8000/analyze-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response)
            });

            const data = await res.json();

            if (!data || data.trust_score === undefined) {
                statusDiv.innerHTML = `
                    <span>❌</span>
                    <span>Unable to analyze email. Please try again.</span>
                `;
                statusDiv.className = "error-state";
                return;
            }

            statusDiv.style.display = "none";
            scoreContainer.style.display = "block";
            
            //Get risk level information based on trust score
            const riskInfo = getRiskLevelInfo(data.trust_score);
            
            //Extract detailed scores from the new API response structure
            const componentScores = data.analysis_details?.component_scores || {};
            const mlRisk = componentScores.ml_risk_score || 0;
            const apiRisk = componentScores.api_risk_score || 0;
            const ruleBasedRisk = componentScores.rule_based_risk_score || 0;
            const finalTrustScore = data.trust_score || 0;
            
            //Extract ML confidence and API status
            const mlAnalysis = data.analysis_details?.ml_analysis || {};
            const mlConfidence = mlAnalysis.confidence || 0;
            const apiAnalysis = data.analysis_details?.api_analysis || {};
            const apiStatus = apiAnalysis.api_status || 'unknown';
            const maliciousCount = apiAnalysis.malicious_urls_found || 0;
            const totalUrlsChecked = apiAnalysis.total_urls_checked || 0;
            
            scoreDiv.className = `trust-score ${riskInfo.className}`;
            scoreDiv.innerHTML = `
                <div class="main-score">
                    <span>${riskInfo.icon}</span>
                    <span>Trust Score: ${finalTrustScore}</span>
                </div>
                <div class="detailed-scores">
                    <div class="score-breakdown">
                        <div class="score-item ml-score-item">
                            <span class="score-label">🤖 ML Risk :</span>
                            <span class="score-value">${mlRisk.toFixed(1)}</span>
                            ${mlConfidence > 0 ? 
                                `<span class="ml-confidence-inline">(${(mlConfidence * 100).toFixed(1)}% conf.)</span>` 
                                : ''}
                        </div>
                        <div class="score-item api-score-item">
                            <span class="score-label">🛡️ Safe Browsing :</span>
                            <span class="score-value">${apiRisk.toFixed(1)}</span>
                            <span class="api-status-inline ${apiStatus}">(${maliciousCount}/${totalUrlsChecked} flagged)</span>
                        </div>
                        <div class="score-item rule-score-item">
                            <span class="score-label">⚙️ Traditional Rules Based :</span>
                            <span class="score-value">${ruleBasedRisk.toFixed(1)}</span>
                        </div>
                    </div>
                </div>
            `;
            
            //Add the risk level text below the score button
            const riskLevelDiv = document.createElement('div');
            riskLevelDiv.className = 'risk-level-text';
            riskLevelDiv.textContent = riskInfo.text;
            scoreContainer.appendChild(riskLevelDiv);

            displayGoogleSafeBrowsingStatus(apiStatus, totalUrlsChecked, maliciousCount, scoreContainer);

            if (data.detected_threats && data.detected_threats.length > 0) {
                const actualThreats = data.detected_threats.filter(threat => 
                    !threat.includes('All URLs verified safe by Google Safe Browsing') &&
                    !threat.includes('Google Safe Browsing: Service') &&
                    !threat.toLowerCase().includes('google safe browsing') ||
                    threat.includes('Google Safe Browsing: Harmful content detected') 
                );
                
                if (actualThreats.length > 0) {
                    const threatsDiv = document.createElement('div');
                    threatsDiv.className = 'threats-section';
                    
                    const threatsHeader = document.createElement('div');
                    threatsHeader.className = 'threats-header';
                    threatsHeader.textContent = '⚠️ Detected Security Issues:';
                    
                    const threatsList = document.createElement('div');
                    threatsList.className = 'threats-list';
                    
                    //Show first 3 threats
                    const visibleThreats = actualThreats.slice(0, 3);
                    const hiddenThreats = actualThreats.slice(3);
                    
                    //Add visible threats with enhanced styling for API threats
                    visibleThreats.forEach(threat => {
                        const threatItem = document.createElement('div');
                        threatItem.className = 'threat-item';
                        
                        if (threat.includes('Harmful content detected')) {
                            threatItem.classList.add('api-threat');
                        }
                        
                        threatItem.textContent = `• ${threat}`;
                        threatsList.appendChild(threatItem);
                    });
                    
                    //Add expandable section if there are more threats
                    if (hiddenThreats.length > 0) {
                        const hiddenThreatsDiv = document.createElement('div');
                        hiddenThreatsDiv.className = 'hidden-threats';
                        hiddenThreatsDiv.style.display = 'none';
                        
                        hiddenThreats.forEach(threat => {
                            const threatItem = document.createElement('div');
                            threatItem.className = 'threat-item';
                            
                            if (threat.includes('Harmful content detected')) {
                                threatItem.classList.add('api-threat');
                            }
                            
                            threatItem.textContent = `• ${threat}`;
                            hiddenThreatsDiv.appendChild(threatItem);
                        });
                        
                        const toggleButton = document.createElement('div');
                        toggleButton.className = 'threat-toggle';
                        toggleButton.innerHTML = `<span class="toggle-icon">▼</span> Show ${hiddenThreats.length} more issues`;
                        
                        let isExpanded = false;
                        toggleButton.addEventListener('click', () => {
                            isExpanded = !isExpanded;
                            if (isExpanded) {
                                hiddenThreatsDiv.style.display = 'block';
                                toggleButton.innerHTML = `<span class="toggle-icon">▲</span> Show less`;
                            } else {
                                hiddenThreatsDiv.style.display = 'none';
                                toggleButton.innerHTML = `<span class="toggle-icon">▼</span> Show ${hiddenThreats.length} more issues`;
                            }
                        });
                        
                        threatsList.appendChild(toggleButton);
                        threatsList.appendChild(hiddenThreatsDiv);
                    }
                    
                    threatsDiv.appendChild(threatsHeader);
                    threatsDiv.appendChild(threatsList);
                    scoreContainer.appendChild(threatsDiv);
                }
            }

            //Show URL analysis section with Google Safe Browsing integration
            const totalUrls = response.urls?.length || 0;
            
            //Only show URL section if there are URLs or suspicious findings
            if (totalUrls > 0) {
                urlsSection.style.display = "block";
                
                //Process URL analysis from both rule-based and Google Safe Browsing API
                const ruleBasedUrlAnalysis = data.analysis_details?.rule_based_analysis?.url_analysis || {};
                const safeBrowsingAnalysis = data.analysis_details?.api_analysis || {};
                
                const ruleSuspiciousUrls = ruleBasedUrlAnalysis.suspicious_urls || [];
                const ruleSuspiciousCount = ruleSuspiciousUrls.length;
                const sbMaliciousCount = safeBrowsingAnalysis.malicious_urls_found || 0;
                
                const totalSuspicious = Math.max(ruleSuspiciousCount, sbMaliciousCount);

                urlHeaderText.textContent = `URL Security Analysis (${totalUrls} URLs found)`;

                //Clear previous URLs
                urlsDiv.innerHTML = '';

                //Create URL items with Google Safe Browsing integration
                const urlsFound = response.urls || [];
                
                urlsFound.forEach((url) => {
                    const ruleSuspiciousUrl = ruleSuspiciousUrls.find(suspiciousUrl => 
                        suspiciousUrl.url === url || url.includes(suspiciousUrl.url) || suspiciousUrl.url.includes(url)
                    );
                    
                    const isRuleSuspicious = !!ruleSuspiciousUrl;
                    const ruleThreats = ruleSuspiciousUrl ? ruleSuspiciousUrl.threats || [] : [];
                    
                    //Check Google Safe Browsing threats
                    const apiThreats = getSafeBrowsingThreatsForUrl(url, safeBrowsingAnalysis);
                    
                    const urlItem = createUrlItem(url, isRuleSuspicious, ruleThreats, apiThreats);
                    urlsDiv.appendChild(urlItem);
                });

                // Add comprehensive summary with Google Safe Browsing results
                if (totalSuspicious > 0 || sbMaliciousCount > 0) {
                    const summaryDiv = document.createElement('div');
                    summaryDiv.className = 'url-threat-summary';
                    
                    let summaryText = `🚨 Security Threats Detected: `;
                    const threats = [];
                    
                    if (ruleSuspiciousCount > 0) {
                        threats.push(`${ruleSuspiciousCount} rule-based detection${ruleSuspiciousCount > 1 ? 's' : ''}`);
                    }
                    if (sbMaliciousCount > 0) {
                        threats.push(`${sbMaliciousCount} Google Safe Browsing detection${sbMaliciousCount > 1 ? 's' : ''}`);
                    }
                    
                    summaryText += threats.join(', ') + ` out of ${totalUrls} URLs`;
                    summaryDiv.innerHTML = summaryText;
                    urlsDiv.appendChild(summaryDiv);
                }
                
            } else {
                urlsSection.style.display = "none";
            }

        } catch (error) {
            console.error("Analysis failed:", error);
            statusDiv.innerHTML = `
                <span>❌</span>
                <span>Connection error. Please ensure the MailSentinel backend is running on port 8000.</span>
            `;
            statusDiv.className = "error-state";
        }
    });
});