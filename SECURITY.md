# Security Policy for Eventron

Eventron takes security very seriously. This document outlines our security practices, supported versions, and the process for reporting vulnerabilities.

## Supported Versions

| Version | Supported          | Notes |
| ------- | ------------------ | ----- |
| v1.x.x  | :white_check_mark: | Active Development |

## Reporting a Vulnerability

We deeply appreciate the efforts of security researchers and our user community to keep Eventron secure.

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, please send an email to **prattyanghosh@gmail.com**. 
Please include:
- A detailed description of the vulnerability.
- Steps to reproduce the issue.
- (Optional) A potential fix or mitigation.

You should receive a response acknowledging receipt within 48 hours. If the vulnerability is confirmed, we will work to release a patch as soon as possible.

## Our Security Practices

Eventron employs several standard security measures to protect user data and ensure platform integrity:

- **Data Encryption**: Sensitive data is encrypted both in transit (via TLS/HTTPS) and at rest.
- **Authentication**: We use robust authentication providers (like Firebase) to handle user identities securely.
- **Payment Processing**: All financial transactions are securely processed through trusted third-party providers (like Razorpay). We do not store raw credit card information on our servers.
- **Environment Security**: Sensitive configurations and API keys are managed exclusively via environment variables and are never committed to the repository.
- **Dependency Updates**: We regularly monitor and update our frontend and backend dependencies to patch known vulnerabilities.

## Responsible Disclosure

We ask that you:
- Give us a reasonable amount of time to fix the issue before publishing it elsewhere.
- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our service.

Thank you for helping keep Eventron safe!
