<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SLOTZ Booking Calendar

This project is a standalone “Booking Calendar” web app for JOBZ CAFE®. It provides professional scheduling, bookings, and two-way calendar synchronization with Outlook.

## Run Locally

**Prerequisites:** [Node.js](https://nodejs.org/) (version 18 or higher recommended)

1.  **Install dependencies:**
    Open your terminal in the project root and run:
    ```bash
    npm install
    ```

2.  **Set up Environment Variables:**
    -   Copy the example environment file:
        ```bash
        cp .env.example .env.local
        ```
    -   Open the new `.env.local` file and replace the placeholder values with your actual API keys. This file is ignored by Git, so your keys will remain secure. You will need keys for:
        -   **Microsoft Azure**: For Outlook Calendar integration.
        -   **Resend**: For sending email notifications.

3.  **Run the app:**
    ```bash
    npm run dev
    ```

    The application will be available at `http://localhost:3000`.
