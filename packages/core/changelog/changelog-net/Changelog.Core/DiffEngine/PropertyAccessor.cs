using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Reflection;

namespace Changelog;

/// <summary>
/// High-performance property accessor using compiled expression trees
/// Caches compiled accessors to amortize compilation cost
/// </summary>
public static class PropertyAccessor {
	private static readonly ConcurrentDictionary<Type, TypeAccessor> _accessorCache = new();

	/// <summary>
	/// Get a TypeAccessor for the given type (cached)
	/// </summary>
	public static TypeAccessor GetAccessor(Type type) {
		return _accessorCache.GetOrAdd(type, t => new TypeAccessor(t));
	}

	/// <summary>
	/// Provides fast property access for a specific type
	/// </summary>
	public class TypeAccessor {
		private readonly Dictionary<string, Func<object, object?>> _getters;
		private readonly Dictionary<string, Action<object, object?>> _setters;
		private readonly PropertyInfo[] _properties;

		public TypeAccessor(Type type) {
			_properties = type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
				.Where(p => p.CanRead && p.GetIndexParameters().Length == 0)
				.ToArray();

			_getters = new Dictionary<string, Func<object, object?>>(_properties.Length);
			_setters = new Dictionary<string, Action<object, object?>>(_properties.Length);

			foreach (var prop in _properties) {
				_getters[prop.Name] = CompileGetter(prop);

				if (prop.CanWrite)
					_setters[prop.Name] = CompileSetter(prop);
			}
		}

		/// <summary>
		/// Get all readable properties for this type
		/// </summary>
		public PropertyInfo[] Properties => _properties;

		/// <summary>
		/// Get property value using compiled accessor (fast)
		/// </summary>
		public object? GetValue(object obj, string propertyName) {
			if (_getters.TryGetValue(propertyName, out var getter))
				return getter(obj);
			return null;
		}

		/// <summary>
		/// Set property value using compiled accessor (fast)
		/// </summary>
		public void SetValue(object obj, string propertyName, object? value) {
			if (_setters.TryGetValue(propertyName, out var setter))
				setter(obj, value);
		}

		/// <summary>
		/// Check if property exists
		/// </summary>
		public bool HasProperty(string propertyName) {
			return _getters.ContainsKey(propertyName);
		}

		/// <summary>
		/// Compile a fast property getter using expression trees
		/// </summary>
		private static Func<object, object?> CompileGetter(PropertyInfo property) {
			// Create expression: (object obj) => ((TObject)obj).Property
			var objParam = Expression.Parameter(typeof(object), "obj");
			var typedObj = Expression.Convert(objParam, property.DeclaringType!);
			var propertyAccess = Expression.Property(typedObj, property);
			var boxed = Expression.Convert(propertyAccess, typeof(object));

			var lambda = Expression.Lambda<Func<object, object?>>(boxed, objParam);
			return lambda.Compile();
		}

		/// <summary>
		/// Compile a fast property setter using expression trees
		/// </summary>
		private static Action<object, object?> CompileSetter(PropertyInfo property) {
			// Create expression: (object obj, object value) => ((TObject)obj).Property = (TProperty)value
			var objParam = Expression.Parameter(typeof(object), "obj");
			var valueParam = Expression.Parameter(typeof(object), "value");

			var typedObj = Expression.Convert(objParam, property.DeclaringType!);
			var typedValue = Expression.Convert(valueParam, property.PropertyType);
			var propertyAccess = Expression.Property(typedObj, property);
			var assignment = Expression.Assign(propertyAccess, typedValue);

			var lambda = Expression.Lambda<Action<object, object?>>(assignment, objParam, valueParam);
			return lambda.Compile();
		}
	}
}
