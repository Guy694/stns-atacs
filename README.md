This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## ATACS Agent

### Database Migration

Run `database/agent_inventory.sql` after the main auth schema so the agent tables exist before creating enrollment tokens. The script adds `agent_enrollments` and `agent_devices`, and `users.id` must already be `bigint unsigned`.

### Admin Flow

1. Open `/admin/settings/agent`.
2. Create an enrollment token for the target facility.
3. Copy the token once and share it with the officer or installer.
4. Revoke the token after the rollout if needed.

### Windows Agent

Install the agent on a Windows client machine with PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File install-atacs-agent.ps1 -ApiBaseUrl https://stns-atacs.vercel.app -EnrollmentToken <token>
```

The installer enrolls the device, stores credentials under `ProgramData`, and registers a scheduled task to report inventory every 4 hours.

### Linux Agent

Install the agent on a Linux client machine with sudo or root access:

```bash
sudo bash install-atacs-agent.sh --api-base-url https://stns-atacs.vercel.app --enrollment-token <token>
```

The installer copies the Python agent into `/opt/atacs-agent`, stores config under `/var/lib/atacs-agent`, and registers a systemd timer or cron fallback to report inventory every 4 hours.

### What the Agent Sends

- Hostname and device fingerprint
- CPU, RAM, disk, operating system, and IP details
- Current user and hardware identifiers
- Periodic heartbeat updates so the admin page can show online/offline status

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
