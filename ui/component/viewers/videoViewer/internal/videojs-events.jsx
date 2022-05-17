// @flow
import { useEffect } from 'react';
import analytics from 'analytics';

const isDev = process.env.NODE_ENV !== 'production';

const TAP = {
  NONE: 'NONE',
  UNMUTE: 'UNMUTE',
  RETRY: 'RETRY',
};

const VideoJsEvents = ({
  tapToUnmuteRef,
  tapToRetryRef,
  setReload,
  videoTheaterMode,
  playerRef,
  autoplaySetting,
  replay,
  claimId,
  userId,
  claimValues,
  embedded,
  uri,
  doAnalyticsView,
  claimRewards,
  playerServerRef,
  isLivestreamClaim,
}: {
  tapToUnmuteRef: any, // DOM element
  tapToRetryRef: any, // DOM element
  setReload: any, // react hook
  videoTheaterMode: any, // dispatch function
  playerRef: any, // DOM element
  autoplaySetting: boolean,
  replay: boolean,
  claimId: ?string,
  userId: ?number,
  claimValues: any,
  embedded: boolean,
  clearPosition: (string) => void,
  uri: string,
  doAnalyticsView: (string, number) => any,
  claimRewards: () => void,
  playerServerRef: any,
  isLivestreamClaim: boolean,
}) => {
  /**
   * Analytics functionality that is run on first video start
   * @param e - event from videojs (from the plugin?)
   * @param data - only has secondsToLoad property
   */
  function doTrackingFirstPlay(e: Event, data: any) {
    // how long until the video starts
    let timeToStartVideo = data.secondsToLoad;

    analytics.playerVideoStartedEvent(embedded);

    // don't send this data on livestream
    if (!isLivestreamClaim) {
      // convert bytes to bits, and then divide by seconds
      const contentInBits = Number(claimValues.source.size) * 8;
      const durationInSeconds = claimValues.video && claimValues.video.duration;
      let bitrateAsBitsPerSecond;
      if (durationInSeconds) {
        bitrateAsBitsPerSecond = Math.round(contentInBits / durationInSeconds);
      }

      // figure out what server the video is served from and then run start analytic event
      // server string such as 'eu-p6'
      const playerPoweredBy = playerServerRef.current;

      // populates data for watchman, sends prom and matomo event
      analytics.videoStartEvent(
        claimId,
        timeToStartVideo,
        playerPoweredBy,
        userId,
        uri,
        this, // pass the player
        bitrateAsBitsPerSecond
      );
    }

    // hit backend to mark a view
    doAnalyticsView(uri, timeToStartVideo).then(() => {
      claimRewards();
    });
  }

  function onInitialPlay() {
    const player = playerRef.current;

    const bigPlayButton = document.querySelector('.vjs-big-play-button');
    if (bigPlayButton) bigPlayButton.style.setProperty('display', 'none');

    if (player && (player.muted() || player.volume() === 0)) {
      // The css starts as "hidden". We make it visible here without
      // re-rendering the whole thing.
      showTapButton(TAP.UNMUTE);
    } else {
      showTapButton(TAP.NONE);
    }
  }

  function onVolumeChange() {
    const player = playerRef.current;
    if (player && !player.muted()) {
      showTapButton(TAP.NONE);
    }
  }

  function onError() {
    const player = playerRef.current;
    showTapButton(TAP.RETRY);

    // reattach initial play listener in case we recover from error successfully
    // $FlowFixMe
    player.one('play', onInitialPlay);

    if (player && player.loadingSpinner) {
      player.loadingSpinner.hide();
    }
  }

  // const onEnded = React.useCallback(() => {
  //   if (!adUrl) {
  //     showTapButton(TAP.NONE);
  //   }
  // }, [adUrl]);

  useEffect(() => {
    const player = playerRef.current;
    if (player) {
      const controlBar = player.getChild('controlBar');
      const theaterButton = controlBar.getChild('TheaterModeButton');
      if (theaterButton) {
        theaterButton.controlText(videoTheaterMode ? __('Default Mode (t)') : __('Theater Mode (t)'));
      }
    }
  }, [videoTheaterMode]);

  // when user clicks 'Unmute' button, turn audio on and hide unmute button
  function unmuteAndHideHint() {
    const player = playerRef.current;
    if (player) {
      player.muted(false);
      if (player.volume() === 0) {
        player.volume(1.0);
      }
    }
    showTapButton(TAP.NONE);
  }

  function retryVideoAfterFailure() {
    const player = playerRef.current;
    if (player) {
      setReload(Date.now());
      showTapButton(TAP.NONE);
    }
  }

  function showTapButton(tapButton) {
    const setButtonVisibility = (theRef, newState) => {
      // Use the DOM to control the state of the button to prevent re-renders.
      if (theRef.current) {
        const curState = theRef.current.style.visibility === 'visible';
        if (newState !== curState) {
          theRef.current.style.visibility = newState ? 'visible' : 'hidden';
        }
      }
    };

    switch (tapButton) {
      case TAP.NONE:
        setButtonVisibility(tapToUnmuteRef, false);
        setButtonVisibility(tapToRetryRef, false);
        break;
      case TAP.UNMUTE:
        setButtonVisibility(tapToUnmuteRef, true);
        setButtonVisibility(tapToRetryRef, false);
        break;
      case TAP.RETRY:
        setButtonVisibility(tapToUnmuteRef, false);
        setButtonVisibility(tapToRetryRef, true);
        break;
      default:
        if (isDev) throw new Error('showTapButton: unexpected ref');
        break;
    }
  }

  useEffect(() => {
    const player = playerRef.current;
    if (player) {
      const touchOverlay = player.getChild('TouchOverlay');
      const controlBar = player.getChild('controlBar') || touchOverlay.getChild('controlBar');
      const autoplayButton = controlBar.getChild('AutoplayNextButton');

      if (autoplayButton) {
        const title = autoplaySetting ? __('Autoplay Next On') : __('Autoplay Next Off');

        autoplayButton.controlText(title);
        autoplayButton.setAttribute('aria-label', title);
        autoplayButton.setAttribute('aria-checked', autoplaySetting);
      }
    }
  }, [autoplaySetting]);

  useEffect(() => {
    const player = playerRef.current;
    if (replay && player) {
      player.play();
    }
  }, [replay]);

  function initializeEvents() {
    const player = playerRef.current;

    player.one('play', onInitialPlay);
    player.on('volumechange', onVolumeChange);
    player.on('error', onError);
    // custom tracking plugin, event used for watchman data, and marking view/getting rewards
    player.on('tracking:firstplay', doTrackingFirstPlay);
    // hide forcing control bar show
    player.on('canplaythrough', function () {
      setTimeout(function () {
        // $FlowFixMe
        const vjsControlBar = document.querySelector('.vjs-control-bar');
        if (vjsControlBar) vjsControlBar.style.removeProperty('opacity');
      }, 1000 * 3); // wait 3 seconds to hit control bar
    });
    player.on('playing', function () {
      // $FlowFixMe
      document.querySelector('.vjs-big-play-button').style.setProperty('display', 'none', 'important');
    });
    // player.on('ended', onEnded);

    if (isLivestreamClaim && player) {
      player.liveTracker.on('liveedgechange', async () => {
        // Only respond to when we fall behind
        if (player.liveTracker.atLiveEdge()) return;
        // Don't respond to when user has paused the player
        if (player.paused()) return;

        setTimeout(() => {
          // Do not jump ahead if user has paused the player
          if (player.paused()) return;
          player.liveTracker.seekToLiveEdge();
        }, 5 * 1000);
      });
    }
  }

  return {
    retryVideoAfterFailure,
    unmuteAndHideHint,
    initializeEvents,
  };
};

export default VideoJsEvents;
