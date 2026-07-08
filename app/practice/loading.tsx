import styles from "./card.module.css";

export default function PracticeLoading() {
  return (
    <div className={styles.stage}>
      <div className={`${styles.phone} ${styles.loadingPhone}`}>
        <svg className={styles.loadingCloudLayer} viewBox="0 0 340 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g className={styles.loadingCloud}>
            <ellipse cx="74" cy="118" rx="34" ry="15" fill="#fff" />
            <ellipse cx="96" cy="108" rx="22" ry="14" fill="#fff" />
            <ellipse cx="52" cy="112" rx="18" ry="11" fill="#fff" />
            <ellipse cx="118" cy="119" rx="16" ry="9" fill="#D7EAF9" opacity=".55" />
          </g>
          <g className={`${styles.loadingCloud} ${styles.loadingCloudTwo}`}>
            <ellipse cx="250" cy="176" rx="26" ry="12" fill="#fff" opacity=".92" />
            <ellipse cx="267" cy="168" rx="17" ry="10" fill="#fff" opacity=".92" />
            <ellipse cx="228" cy="178" rx="17" ry="8" fill="#D7EAF9" opacity=".52" />
          </g>
          <g className={`${styles.loadingCloud} ${styles.loadingCloudThree}`} transform="translate(-22 296)">
            <ellipse cx="74" cy="118" rx="34" ry="15" fill="#fff" />
            <ellipse cx="96" cy="108" rx="22" ry="14" fill="#fff" />
            <ellipse cx="52" cy="112" rx="18" ry="11" fill="#fff" />
            <ellipse cx="118" cy="119" rx="16" ry="9" fill="#D7EAF9" opacity=".55" />
          </g>
        </svg>

        <main className={styles.loadingLoader} aria-live="polite" aria-busy="true">
          <div className={styles.loadingSunBob}>
            <div className={styles.loadingSunBreathe}>
              <svg className={styles.loadingSunSvg} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <defs>
                  <radialGradient id="practiceSunFill" cx="42%" cy="38%" r="70%">
                    <stop offset="0%" stopColor="#FFD25E" />
                    <stop offset="70%" stopColor="#FBB63B" />
                    <stop offset="100%" stopColor="#F6A52E" />
                  </radialGradient>
                </defs>

                <g className={styles.loadingSunRays}>
                  <g fill="#FBC24A">
                    <rect x="94.5" y="32" width="11" height="20" rx="5.5" />
                    <rect x="94.5" y="32" width="11" height="20" rx="5.5" transform="rotate(45 100 100)" />
                    <rect x="94.5" y="32" width="11" height="20" rx="5.5" transform="rotate(90 100 100)" />
                    <rect x="94.5" y="32" width="11" height="20" rx="5.5" transform="rotate(135 100 100)" />
                    <rect x="94.5" y="32" width="11" height="20" rx="5.5" transform="rotate(180 100 100)" />
                    <rect x="94.5" y="32" width="11" height="20" rx="5.5" transform="rotate(225 100 100)" />
                    <rect x="94.5" y="32" width="11" height="20" rx="5.5" transform="rotate(270 100 100)" />
                    <rect x="94.5" y="32" width="11" height="20" rx="5.5" transform="rotate(315 100 100)" />
                  </g>
                </g>

                <g className={styles.loadingSunFace}>
                  <circle cx="100" cy="100" r="49" fill="url(#practiceSunFill)" />
                  <circle cx="100" cy="100" r="49" fill="none" stroke="#F4A02B" strokeOpacity=".35" strokeWidth="3" />
                  <ellipse cx="79" cy="109" rx="8" ry="5.5" fill="#FF9C6E" opacity=".55" />
                  <ellipse cx="121" cy="109" rx="8" ry="5.5" fill="#FF9C6E" opacity=".55" />
                  <circle cx="85" cy="94" r="6" fill="#5A3B17" />
                  <circle cx="115" cy="94" r="6" fill="#5A3B17" />
                  <circle cx="87" cy="92" r="1.9" fill="#fff" />
                  <circle cx="117" cy="92" r="1.9" fill="#fff" />
                  <path d="M85 110 Q100 126 115 110" stroke="#5A3B17" strokeWidth="5.5" strokeLinecap="round" fill="none" />
                </g>
              </svg>
            </div>
          </div>

          <div className={styles.loadingWord} aria-label="loading">
            <span className={styles.loadingLetters}>
              <span>l</span>
              <span>o</span>
              <span>a</span>
              <span>d</span>
              <span>i</span>
              <span>n</span>
              <span>g</span>
            </span>
            <span className={styles.loadingDots}>
              <span />
              <span />
              <span />
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
