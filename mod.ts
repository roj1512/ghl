import reservedPaths from "https://raw.githubusercontent.com/Mottie/github-reserved-names/master/reserved-names.json" assert {
  type: "json",
};

const patchDiffRegex = /[.](patch|diff)$/;
const releaseRegex = /^releases[/]tag[/]([^/]+)/;
const labelRegex = /^labels[/]([^/]+)/;
const compareRegex = /^compare[/]([^/]+)/;
const pullRegex =
  /^pull[/](\d+)(?:[/]([^/]+))?(?:[/]([\da-f]{40})[.][.]([\da-f]{40}))?$/;
const issueRegex = /^issues[/](\d+)$/;
const commitRegex = /^commit[/]([\da-f]{40})$/;
const releaseArchiveRegex = /^archive[/](.+)([.]zip|[.]tar[.]gz)/;
const releaseDownloadRegex = /^releases[/]download[/]([^/]+)[/](.+)/;
const dependentsRegex = /^network[/]dependents[/]?$/;
const dependenciesRegex = /^network[/]dependencies[/]?$/;

function styleRevision(revision: string) {
  if (!revision) {
    return '';
  }

  revision = revision.replace(patchDiffRegex, "");
  if (/^[0-9a-f]{40}$/.test(revision)) {
    revision = revision.slice(0, 7);
  }

  return `<code>${revision}</code>`;
}

function commentIndicator(hash: string) {
  if (hash.startsWith("#issue-") || hash.startsWith("#commitcomment-")) {
    return " (comment)";
  }

  if (
    hash.startsWith("#pullrequestreview-") || hash.startsWith("#discussion_r")
  ) {
    return " (review)";
  }

  return "";
}

// Filter out null values
function joinValues(array: string[], delimiter = "/") {
  return array.filter((s) => s).join(delimiter);
}

export 	function shortenURL(
  href: string,
  currentUrl: string | URL = "https://github.com",
) {
  if (!href) {
    return;
  }

  currentUrl = new URL(currentUrl);
  const currentRepo = currentUrl.pathname.slice(1).split("/", 2).join("/");

  /**
   * Parse URL
   */
  const url = new URL(href);
  const {
    origin,
    pathname,
    search,
    searchParams,
    hash,
  } = url;

  const pathnameParts = pathname.slice(1).split("/"); // ['user', 'repo', 'pull', '342']
  const repoPath = pathnameParts.slice(2).join("/"); // 'pull/342'

  const isRaw = [
    "https://raw.githubusercontent.com",
    "https://cdn.rawgit.com",
    "https://rawgit.com",
  ].includes(origin);

  const isRedirection = [
    "https://togithub.com", // Renovate
    "https://github-redirect.dependabot.com", // Dependabot
  ].includes(origin);

  let [
    user,
    repo,
    type,
    revision,
    ...filePathSlices
  ] = pathnameParts;

  if (isRaw) {
    [
      user,
      repo,
      // Raw URLs don't have `blob` here
      revision,
      ...filePathSlices
    ] = pathnameParts;
    type = "raw";
  }

  revision = styleRevision(revision);
  const filePath = filePathSlices.join("/");

  const isLocal = origin === currentUrl.origin;
  const isThisRepo = (isLocal || isRaw || isRedirection) &&
    currentRepo === `${user}/${repo}`;
  const isReserved = reservedPaths.includes(user);
  const isDependents = dependentsRegex.test(repoPath);
  const isDependencies = dependenciesRegex.test(repoPath);
  const [, diffOrPatch] = repoPath.match(patchDiffRegex) || [];
  const [, release] = repoPath.match(releaseRegex) || [];
  const [, releaseTag, releaseTagExt] = repoPath.match(releaseArchiveRegex) ||
    [];
  const [, downloadTag, downloadFilename] =
    repoPath.match(releaseDownloadRegex) || [];
  const [, label] = repoPath.match(labelRegex) || [];
  const [, compare] = repoPath.match(compareRegex) || [];
  const [, pull, pullPage, pullPartialStart, pullPartialEnd] =
    repoPath.match(pullRegex) || [];
  const [, issue] = isRedirection ? repoPath.match(issueRegex) || [] : [];
  const [, commit] = isRedirection ? repoPath.match(commitRegex) || [] : [];
  const isFileOrDir = revision && [
    "raw",
    "tree",
    "blob",
    "blame",
    "commits",
  ].includes(type);

  const repoUrl = isThisRepo ? "" : `${user}/${repo}`;

  /**
   * Shorten URL
   */

  if (
    isReserved || pathname === "/" || (!isLocal && !isRaw && !isRedirection)
  ) {
    return href
      .replace(/^https:[/][/]/, "")
      .replace(/^www[.]/, "")
      .replace(/[/]$/, "");
  }

  if (user && !repo) {
    return `@${user}${search}${hash}`;
  }

  if (isFileOrDir) {
    const revisioned = joinValues(
      [joinValues([repoUrl, revision], "@"), filePath],
      "/",
    );
    const partial = `${revisioned}${search}${hash}`;
    if (type !== "blob" && type !== "tree") {
      return `${partial} (${type})`;
    }

    return partial;
  }

  if (diffOrPatch) {
    const partial = joinValues([repoUrl, revision], "@");
    return `${partial}.${diffOrPatch}${search}${hash}`;
  }

  if (release) {
    const partial = joinValues([repoUrl, `<code>${release}</code>`], "@");
    return `${partial}${search}${hash} (release)`;
  }

  if (releaseTagExt) {
    const partial = joinValues([repoUrl, `<code>${releaseTag}</code>`], "@");
    return `${partial}${releaseTagExt}${search}${hash}`;
  }

  if (downloadFilename) {
    const partial = joinValues([repoUrl, `<code>${downloadTag}</code>`], "@");
    return `${partial} ${downloadFilename}${search}${hash} (download)`;
  }

  if (label) {
    return (
      joinValues([repoUrl, decodeURIComponent(label)]) +
      `${search}${hash} (label)`
    );
  }

  if (isDependents) {
    return `${user}/${repo} (dependents)`;
  }

  if (isDependencies) {
    return `${user}/${repo} (dependencies)`;
  }

  if (pull) {
    if (pullPage === "files" && pullPartialStart && pullPartialEnd) {
      return `<code>${pullPartialStart.slice(0, 8)}..${
        pullPartialEnd.slice(0, 8)
      }</code> (#${pull})`;
    }

    if (pullPage) {
      return `${repoUrl}#${pull} (${pullPage})`;
    }
  }

  if (compare) {
    const partial = joinValues([repoUrl, revision], "@");
    return `${partial}${search}${hash} (compare)`;
  }

  // Shorten URLs that would otherwise be natively shortened
  if (isRedirection) {
    if (issue) {
      return `${repoUrl}#${issue}${commentIndicator(hash)}`;
    }

    if (pull) {
      return `${repoUrl}#${pull}${commentIndicator(hash)}`;
    }

    if (commit) {
      return joinValues([repoUrl, `<code>${commit.slice(0, 7)}</code>`], "@") +
        commentIndicator(hash);
    }
  }

  let query = searchParams.get("q") ?? "";
  if (query) {
    searchParams.delete("q");
    if (pathname.endsWith("/issues")) {
      query = query.replace("is:issue", "");
    } else if (pathname.endsWith("/pulls")) {
      query = query.replace("is:pr", "");
    }

    query = ` (${query.replace(/\s+/g, " ").trim()})`;
  }

  // Drop leading and trailing slash of relative path
  return pathname.replace(/^[/]|[/]$/g, "") + url.search + hash + query;
}

