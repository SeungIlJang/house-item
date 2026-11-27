// 이용약관 · 개인정보 처리방침 · 계정 삭제 안내의 영어판. 한국어판(documents.ts)을 옮긴 것이다.
//
// ⚠️ 한국어판을 고치면 이 파일도 같은 내용으로 고친다. 두 판이 다르면 한국어판이 우선한다고 안내한다.
import type { LegalDocument } from './documents'

type Operator = { name: string; email: string; effectiveDate: string }

const SERVICE = 'Home Items (집안의모든것)'
const TRANSLATION_NOTE = 'This is an English translation. If it differs from the Korean version, the Korean version applies.'

export function englishDocuments(operator: Operator): Record<'terms' | 'privacy' | 'account-deletion', () => LegalDocument> {
  const contactLine = () => (operator.email ? `Contact: ${operator.email}` : 'A contact email will be provided soon.')
  const operatorLine = () => (operator.name ? `Operator: ${operator.name}` : 'Operator details will be provided soon.')

  return {
    privacy: () => ({
      title: 'Privacy Policy',
      intro: `${SERVICE} (the "Service") handles users' personal information as described below. Effective date: ${operator.effectiveDate}. ${TRANSLATION_NOTE}`,
      sections: [
        {
          heading: '1. Information we collect',
          bullets: [
            'Google sign-in: name, profile photo, email address (when verified by Google), Google account identifier',
            'Kakao sign-in: nickname, profile photo (if you consent), Kakao member number',
            'Information you enter: names of homes, places and storage spots; item names, descriptions, notes, quantities, purchase dates and expiry dates; categories; tags',
            'Photos of items that you upload',
            'We do not collect passwords. Sign-in is only through Google or Kakao.',
            'Information collected by Google when ads are shown in the Android app: advertising ID, IP address, device and app information (see section 5)',
          ],
        },
        {
          heading: '2. How we use it',
          bullets: [
            'Identifying members and keeping you signed in',
            'Providing the features of the Service, such as recording and searching where items are kept and expiry reminders',
            'Diagnosing errors and keeping the Service stable',
          ],
          paragraphs: ['We do not use the information you register (items, photos, locations, names and so on) for advertising, and we do not sell it. See section 5 for the ads shown in the app.'],
        },
        {
          heading: '3. Retention and deletion',
          paragraphs: [
            'When you delete your account, we delete your account information and all data you registered (homes, places, items, photos, categories, tags) without delay. Deleted data cannot be restored.',
            'However, it may remain for up to 30 days in database recovery points kept for disaster recovery, after which it disappears automatically.',
          ],
        },
        {
          heading: '4. Processors and international transfer',
          paragraphs: ['The Service uses the cloud provider below to store data and operate, and personal information is transferred abroad in the process.'],
          bullets: [
            'Recipient: Cloudflare, Inc.',
            'Countries: the United States and other countries where Cloudflare has data centers',
            'Items transferred: all information in section 1',
            'When and how: sent over encrypted connections (HTTPS) while you use the Service',
            'Purpose: data storage, providing the Service, and automatically reading the name and expiry date from photos you add on the add-item screen (processed by Cloudflare AI; photos sent for reading are not stored after processing)',
            'Retention: until you delete your account',
          ],
        },
        {
          heading: '5. Third parties and advertising',
          paragraphs: [
            'We do not provide the information you register to third parties, except when required by law.',
            'The Android app shows banner ads from Google AdMob (the web version has no ads). To serve and measure ads, Google may directly collect and use the device advertising ID, IP address, device and app information, and ad view and click information, and this information is processed on Google servers abroad (such as in the United States). The Service does not pass the items, photos or names you register to advertising companies.',
            'If you do not want personalized ads, you can delete or reset the advertising ID in your device under Settings → Google → Ads. How Google uses information: https://policies.google.com/technologies/partner-sites',
          ],
        },
        {
          heading: '6. How photo files are stored',
          paragraphs: [
            'Item photos are stored at random addresses that are hard to guess. Only you can see your list of photos, but anyone who learns the address of a photo can open that photo. We recommend not uploading photos that show sensitive information such as ID cards or payment cards.',
          ],
        },
        {
          heading: '7. Information stored on your device',
          bullets: [
            'An authentication token that keeps you signed in',
            'The sign-in method you used last and your expiry reminder settings',
            'Expiry reminders are scheduled only on your device and are not sent to the server.',
          ],
        },
        {
          heading: '8. Your rights',
          paragraphs: [
            'You can delete your account at any time from the Profile tab in the app, and you can edit or delete the information you registered yourself. For other requests to access, correct or delete information, please use the contact below.',
          ],
        },
        {
          heading: '9. Privacy officer and contact',
          paragraphs: [operatorLine(), contactLine()],
        },
        {
          heading: '10. Changes',
          paragraphs: ['If this policy changes, we will announce it in the app or on this page before it takes effect.'],
        },
      ],
    }),

    terms: () => ({
      title: 'Terms of Service',
      intro: `These terms set out the basics of using ${SERVICE} (the "Service"). Effective date: ${operator.effectiveDate}. ${TRANSLATION_NOTE}`,
      sections: [
        {
          heading: '1. The Service',
          paragraphs: ['The Service is a tool that helps you record and find where things are kept at home. It is currently free, and the Android app shows ads.'],
        },
        {
          heading: '2. Accounts',
          bullets: [
            'You sign in with a Google or Kakao account.',
            'A separate account may be created for each sign-in method. To see the same data, sign in with the same method.',
            'You are responsible for managing your account and your device.',
          ],
        },
        {
          heading: '3. Content you register',
          bullets: [
            'You keep the rights to the information and photos you register.',
            'You may not register content that infringes the rights of others or violates the law. Such content may be deleted or your use may be restricted.',
            // 수치는 서버의 worker/src/lib/limits.ts 와 같아야 한다.
            'To keep the free Service stable, usage is limited: 3,000 items; photos up to 3 per item, 1,000 per account and 200 per day; up to 10 MB per photo.',
          ],
        },
        {
          heading: '4. Changes and discontinuation',
          paragraphs: [
            'Features may change or the Service may be discontinued for operational reasons. If the Service is shut down, we will give notice in advance so you have time to save your information.',
          ],
        },
        {
          heading: '5. Limitation of liability',
          paragraphs: [
            'The Service is a tool for keeping records and does not guarantee that the recorded location matches where an item actually is. Because the Service is free, the operator is not liable for damage caused by data loss or service interruption unless caused by the operator\'s intent or gross negligence. Please keep important information separately.',
          ],
        },
        {
          heading: '6. Leaving the Service',
          paragraphs: ['You can stop using the Service at any time through Profile → Delete account. All your data is deleted immediately.'],
        },
        {
          heading: '7. Contact',
          paragraphs: [operatorLine(), contactLine()],
        },
      ],
    }),

    'account-deletion': () => ({
      title: 'Account and Data Deletion',
      intro: `How to delete your ${SERVICE} account and all of its data. You can do this on this website even if you have already uninstalled the app.`,
      sections: [
        {
          heading: 'How to delete',
          bullets: [
            '1. Sign in to the app or this website with the method you used to sign up (Google or Kakao).',
            '2. Go to the Profile tab at the bottom.',
            '3. Tap Delete account at the very bottom and type "DELETE" as instructed.',
          ],
        },
        {
          heading: 'Data that is deleted',
          bullets: [
            'Account information (name, profile photo, email, sign-in link information)',
            'Homes, places, storage spots, items, categories and tags you registered',
            'All photo files you uploaded',
          ],
          paragraphs: [
            'Data is deleted immediately and cannot be restored. It may remain for up to 30 days in database recovery points kept for disaster recovery and then disappears automatically.',
          ],
        },
        {
          heading: 'If you cannot sign in',
          paragraphs: ['Tell us the sign-in method and display name you used through the contact below, and we will delete the account after verifying it is yours.', contactLine()],
        },
      ],
    }),
  }
}
