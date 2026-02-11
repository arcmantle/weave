export const formatFileSize = (bytes: number): string => {
	const sizes = [ 'B', 'KB', 'MB', 'GB' ];
	let len = bytes;
	let order = 0;
	while (len >= 1024 && order < sizes.length - 1) {
		order++;
		len = len / 1024;
	}

	return `${ len.toFixed(2) } ${ sizes[order] }`;
};

export const formatDate = (date: Date): string => {
	return new Date(date).toLocaleString();
};
