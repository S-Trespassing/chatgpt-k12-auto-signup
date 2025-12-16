// ==UserScript==
// @name         ChatGPT One-Click Login
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  一键注册并登录 ChatGPT
// @author       Trespassing
// @match        https://chatgpt.com/*
// @match        https://chatgpt.com*
// @match        https://auth.openai.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      pkoa.autoxi.me
// ==/UserScript==

(function() {
    'use strict';

    const REGISTER_URL = "https://pkoa.autoxi.me/api/auth/register";
    const LOGIN_URL = "https://pkoa.autoxi.me/api/auth/login";
    const EMAIL_SUFFIX = "@pkoa.autoxi.me";

    // --- Helpers ---

    function generateRandomString(length) {
        const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    function generateRandomName() {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function waitForElement(selector, callback, timeout = 10000) {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
                callback(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
        }, timeout);
    }

    // Helper: Fill React Input
    function fillReactInput(element, value) {
        if (!element) return;

        // 1. Focus
        element.focus();

        // 2. Native Setter (Bypass React value tracker)
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(element, value);

        // 3. Dispatch Events
        const events = ['input', 'change', 'blur'];
        events.forEach(type => {
            element.dispatchEvent(new Event(type, { bubbles: true }));
        });

        // 4. React Internal Props Hack (The "Nuclear Option")
        // Try to find the internal React props key (usually starts with __reactProps$ or __reactEventHandlers$)
        const reactKey = Object.keys(element).find(key => key.startsWith('__reactProps') || key.startsWith('__reactEventHandlers'));
        if (reactKey) {
            const reactProps = element[reactKey];
            if (reactProps && reactProps.onChange) {
                console.log("Invoking React internal onChange handler...");
                reactProps.onChange({
                    target: { value: value },
                    currentTarget: { value: value },
                    bubbles: true,
                    persist: () => {}, // React synthetic event dummy
                    preventDefault: () => {},
                    stopPropagation: () => {}
                });
            }
        }
    }

    // --- Main UI & Event Logic ---

    function createAndAttachButton() {
        if (document.getElementById('tm-one-click-login')) return;

        const btn = document.createElement('button');
        btn.id = 'tm-one-click-login';
        btn.innerText = '一键登录';
        btn.style.position = 'fixed';
        
        // Load saved position or default
        const savedTop = GM_getValue('btn_top');
        const savedLeft = GM_getValue('btn_left');

        if (savedTop && savedLeft) {
            btn.style.top = savedTop;
            btn.style.left = savedLeft;
            btn.style.right = 'auto';
        } else {
            btn.style.top = '10px';
            btn.style.right = '10px';
        }

        btn.style.zIndex = '9999';
        btn.style.padding = '10px 20px';
        btn.style.backgroundColor = '#10a37f';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.borderRadius = '5px';
        btn.style.cursor = 'pointer'; // Default cursor

        document.body.appendChild(btn);

        // --- Drag Logic ---
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        let hasMoved = false;

        btn.addEventListener('mousedown', (e) => {
            // Only left click
            if (e.button !== 0) return;

            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            
            btn.style.cursor = 'move'; // Change cursor when dragging starts

            const rect = btn.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            // Switch to left/top positioning for dragging
            btn.style.right = 'auto';
            btn.style.left = initialLeft + 'px';
            btn.style.top = initialTop + 'px';
            
            e.preventDefault(); // Prevent text selection
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // Threshold to distinguish click from drag
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                hasMoved = true;
            }

            btn.style.left = (initialLeft + dx) + 'px';
            btn.style.top = (initialTop + dy) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                btn.style.cursor = 'pointer'; // Reset cursor
                if (hasMoved) {
                    // Save new position
                    GM_setValue('btn_top', btn.style.top);
                    GM_setValue('btn_left', btn.style.left);
                }
            }
        });

        // Click Handler - wrapped to check for drag
        btn.addEventListener('click', (e) => {
            if (hasMoved) {
                e.preventDefault();
                e.stopPropagation();
                console.log("Drag detected, click ignored.");
                return;
            }
            handleOneClickLogin();
        });
    }

    // Helper: Update Button State
    function setButtonLoadingState(isLoading) {
        const btn = document.getElementById('tm-one-click-login');
        if (!btn) return;

        if (isLoading) {
            btn.innerText = '登录中...';
            btn.style.backgroundColor = '#666'; // Grey out
            btn.disabled = true;
            btn.style.cursor = 'not-allowed';
        } else {
            btn.innerText = '一键登录';
            btn.style.backgroundColor = '#10a37f'; // Original Green
            btn.disabled = false;
            btn.style.cursor = 'pointer';
        }
    }

    function handleOneClickLogin() {
        setButtonLoadingState(true); // Disable button

        const given_name = generateRandomName();
        const family_name = generateRandomName();
        const emailPrefix = generateRandomString(10);
        const email = emailPrefix + EMAIL_SUFFIX;
        const password = generateRandomString(12);

        const registerData = {
            "given_name": given_name,
            "family_name": family_name,
            "email": email,
            "password": password,
            "invite_code": "ddpkqb"
        };

        console.log(">>> Sending Register Request:", JSON.stringify(registerData, null, 2));

        GM_xmlhttpRequest({
            method: "POST",
            url: REGISTER_URL,
            headers: {
                "content-type": "application/json",
                "origin": "https://pkoa.autoxi.me",
                "referer": "https://pkoa.autoxi.me/register",
                "user-agent": navigator.userAgent
            },
            data: JSON.stringify(registerData),
            onload: function(response) {
                console.log("<<< Register Response:", response.responseText);
                
                if (response.status === 200 || response.status === 201) {
                    console.log(`注册成功! 邮箱: ${email}, 密码: ${password}`);

                    // Perform Login API Call
                    const loginData = {
                        "email": email,
                        "password": password
                    };

                    console.log(">>> Sending Login Request:", JSON.stringify(loginData, null, 2));

                    GM_xmlhttpRequest({
                        method: "POST",
                        url: LOGIN_URL,
                        headers: {
                            "content-type": "application/json",
                            "origin": "https://pkoa.autoxi.me",
                            "referer": "https://pkoa.autoxi.me/login",
                            "user-agent": navigator.userAgent
                        },
                        data: JSON.stringify(loginData),
                        onload: function(loginResp) {
                            console.log("<<< Login Response:", loginResp.responseText);
                            
                            if (loginResp.status === 200 || loginResp.status === 201) {
                                // Both requests complete. Start automation.
                                startAutomationSequence(email);
                                // Note: We don't enable the button here because the page is about to redirect.
                                // If redirection fails or takes time, the user sees "Login..." which is accurate.
                                // If you want to restore it anyway after a timeout, we could do that.
                                setTimeout(() => {
                                     setButtonLoadingState(false);
                                }, 5000); // Safety fallback
                            } else {
                                console.error("Login API failed");
                                alert("登录接口请求失败，请重试");
                                setButtonLoadingState(false);
                            }
                        },
                        onerror: function(err) {
                            console.error("Login Network Error:", err);
                            alert("登录网络错误");
                            setButtonLoadingState(false);
                        }
                    });
                } else {
                    console.error("Registration failed");
                    alert("注册失败，请重试");
                    setButtonLoadingState(false);
                }
            },
            onerror: function(err) {
                console.error("Register Network Error:", err);
                alert("注册网络错误");
                setButtonLoadingState(false);
            }
        });
    }

    function startAutomationSequence(email) {
        // Save state for cross-domain/page-reload persistence
        GM_setValue('tm_login_state', 'filling_email');
        GM_setValue('tm_login_email', email);

        // Check current location to decide next step
        if (location.hostname === 'chatgpt.com') {
            console.log("On chatgpt.com, clicking login button to redirect...");
            waitForElement('[data-testid="login-button"]', (btn) => {
                btn.click();
            });
        } else if (location.hostname === 'auth.openai.com') {
            console.log("Already on auth.openai.com, proceeding to fill email directly...");
            // We are already here, the state observer loop will pick it up or we can call directly
            checkAndExecuteState();
        }
    }

    // --- State Machine / Automation Loop ---

    function checkAndExecuteState() {
        const state = GM_getValue('tm_login_state', 'idle');
        const email = GM_getValue('tm_login_email', '');

        if (state === 'idle') return;

        if (location.hostname === 'auth.openai.com') {
            
            if (state === 'filling_email') {
                // Wait for Email Input
                const emailInputs = document.querySelectorAll("[type='email']");
                if (emailInputs.length > 0) {
                    const emailInput = emailInputs[0];
                    
                    // Double check if value is already set correctly
                    if (emailInput.value === email) {
                         console.log("Email already filled correctly. Proceeding...");
                         GM_setValue('tm_login_state', 'waiting_for_sso');
                         // Trigger button click logic immediately below
                    } else {
                        console.log("Found email input. Filling:", email);
                        fillReactInput(emailInput, email);
                    }

                    // Check again after short delay to ensure persistence
                    setTimeout(() => {
                        if (emailInput.value !== email) {
                            console.log("Value cleared! Retrying fill...");
                            fillReactInput(emailInput, email);
                        } else {
                            // Only advance if stable
                            GM_setValue('tm_login_state', 'waiting_for_sso');
                            
                            // Click Continue
                             const submitBtn = document.querySelector('form.gap-4 .mt-1\\.5') || document.querySelector('button[type="submit"]');
                            if (submitBtn) {
                                console.log("Clicking continue...");
                                submitBtn.click();
                            } else {
                                console.error("Submit button not found!");
                            }
                        }
                    }, 200);
                    
                    // Return here to wait for the timeout loop to handle state transition
                    return; 
                }
            }

            if (state === 'waiting_for_sso') {
                // Check for SSO button
                const ssoBtn = document.querySelector('button[name="ssoConnection"]');
                if (ssoBtn) {
                    console.log("Found SSO button. Clicking...");
                    ssoBtn.click();
                    
                    // Task done? Or reset state?
                    GM_setValue('tm_login_state', 'idle');
                    console.log("Automation sequence completed.");
                }
            }
        }
    }

    // --- Initialization ---

    // 1. Always try to attach button (it handles its own existence check)
    // Run periodically to handle SPA updates
    setInterval(createAndAttachButton, 2000);
    createAndAttachButton();

    // 2. Run State Check Loop
    // This handles the automation steps after page loads/redirects
    setInterval(checkAndExecuteState, 1000);

})();
