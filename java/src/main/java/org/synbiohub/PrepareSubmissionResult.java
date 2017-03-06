package org.synbiohub;

public class PrepareSubmissionResult extends Result
{
	private boolean success;
	private String log;
	private String errorLog;
	private String resultFilename;
	
	public PrepareSubmissionResult(
			PrepareSubmissionJob job,
			boolean success,
			String resultFilename,
			String log,
			String errorLog)
	{
		super(job);
		
		this.success = success;
		this.resultFilename = resultFilename;
		this.log = log;
		this.errorLog = errorLog;
	}
}
