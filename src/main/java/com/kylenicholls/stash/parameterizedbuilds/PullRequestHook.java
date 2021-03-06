package com.kylenicholls.stash.parameterizedbuilds;

import java.io.IOException;
import java.util.List;

import com.kylenicholls.stash.parameterizedbuilds.ciserver.Jenkins;
import com.kylenicholls.stash.parameterizedbuilds.helper.SettingsService;
import com.kylenicholls.stash.parameterizedbuilds.item.Job;
import com.kylenicholls.stash.parameterizedbuilds.item.Job.Trigger;
import com.atlassian.event.api.EventListener;
import com.atlassian.bitbucket.content.AbstractChangeCallback;
import com.atlassian.bitbucket.content.Change;
import com.atlassian.bitbucket.content.ChangeContext;
import com.atlassian.bitbucket.content.ChangeSummary;
import com.atlassian.bitbucket.event.pull.PullRequestOpenedEvent;
import com.atlassian.bitbucket.event.pull.PullRequestReopenedEvent;
import com.atlassian.bitbucket.event.pull.PullRequestRescopedEvent;
import com.atlassian.bitbucket.pull.PullRequest;
import com.atlassian.bitbucket.pull.PullRequestChangesRequest;
import com.atlassian.bitbucket.pull.PullRequestService;
import com.atlassian.bitbucket.repository.Repository;
import com.atlassian.bitbucket.setting.Settings;

public class PullRequestHook {
	private final SettingsService settingsService;
	private final PullRequestService pullRequestService;
	private final Jenkins jenkins;

	public PullRequestHook(SettingsService settingsService,
			PullRequestService pullRequestService,
			Jenkins jenkins) {
		this.settingsService = settingsService;
    	this.pullRequestService = pullRequestService;
    	this.jenkins = jenkins;
	}

	@EventListener
	public void onPullRequestOpened(PullRequestOpenedEvent event)
			throws IOException {
		PullRequest pullRequest = event.getPullRequest();
		triggerFromPR(pullRequest);
	}

	@EventListener
	public void onPullRequestReOpened(PullRequestReopenedEvent event)
			throws IOException {
		PullRequest pullRequest = event.getPullRequest();
		triggerFromPR(pullRequest);
	}

	@EventListener
	public void onPullRequestRescoped(PullRequestRescopedEvent event)
			throws IOException {
		final PullRequest pullRequest = event.getPullRequest();
		if (!event.getPreviousFromHash().equals(pullRequest.getFromRef().getLatestCommit())) {
			triggerFromPR(pullRequest);
		}
	}

	public void triggerFromPR(PullRequest pullRequest) throws IOException {
		final Repository repository = pullRequest.getFromRef().getRepository();
		String branch = pullRequest.getFromRef().getDisplayId();
		Settings settings = settingsService.getSettings(repository);
		if (settings == null){return;}
		for (final Job job : settingsService.getJobs(settings.asMap())){
			final String queryParams = job.getQueryString(branch);
			List<Trigger> triggers = job.getTriggers();
			final String pathRegex = job.getPathRegex();
			String userSlug = pullRequest.getAuthor().getUser().getSlug();
			final String token = jenkins.getUserToken(userSlug);
			if (triggers.contains(Trigger.PULLREQUEST)) {
				if (pathRegex.trim().isEmpty()){
					jenkins.triggerJob(job, queryParams, token);
				} else {
	    			pullRequestService.streamChanges(new PullRequestChangesRequest.Builder(pullRequest).build(), new AbstractChangeCallback() {
	    	            public boolean onChange(Change change) throws IOException {
	    	            	String changedFile = change.getPath().toString();
	    	        		// for each flagged path, check if the changed file matches that path
	    	        		if (changedFile.matches(pathRegex)){
	    	        			jenkins.triggerJob(job, queryParams, token);
	    	        			return false;
	    	        		}
	    	                return true;
	    	            }
	    	            public void onEnd(ChangeSummary summary) throws IOException {
	    	                // noop
	    	            }
	    				public void onStart(ChangeContext context) throws IOException {
	    					// noop
	    				}
	    	        });
				}
			}
		}
	}
}
